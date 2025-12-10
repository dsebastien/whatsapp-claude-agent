import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    type WASocket,
    type BaileysEventMap
} from '@whiskeysockets/baileys'
import { EventEmitter } from 'events'
import pino from 'pino'
// @ts-expect-error - qrcode-terminal doesn't have type declarations
import qrcode from 'qrcode-terminal'
import { initAuthState, type AuthState } from './auth.ts'
import { chunkMessage } from './chunker.ts'
import { parseMessage, isWithinThreshold } from './messages.ts'
import { isWhitelisted, extractGroupInviteCode } from '../utils/phone.ts'
import { formatMessageWithAgentName } from '../utils/agent-name.ts'
import type { Logger } from '../utils/logger.ts'
import type { Config, AgentEvent, GroupConfig } from '../types.ts'

// Create a silent logger for Baileys to suppress its verbose output
const silentLogger = pino({ level: 'silent' })

export interface WhatsAppClientEvents {
    event: (event: AgentEvent) => void
}

export class WhatsAppClient extends EventEmitter {
    private socket: WASocket | null = null
    private authState: AuthState | null = null
    private config: Config
    private logger: Logger
    private isReady = false
    private startTime: Date
    private sentMessageIds: Set<string> = new Set() // Track messages we send to avoid loops
    private groupConfig: GroupConfig | null = null // Group mode configuration

    constructor(config: Config, logger: Logger) {
        super()
        this.config = config
        this.logger = logger
        this.startTime = new Date()
    }

    async connect(): Promise<void> {
        this.logger.info('Initializing WhatsApp connection...')

        // Initialize auth state
        this.authState = await initAuthState(this.config.sessionPath)

        // Fetch latest Baileys version
        const { version } = await fetchLatestBaileysVersion()
        this.logger.debug(`Using Baileys version: ${version.join('.')}`)

        // Create socket with silent logger to suppress Baileys verbose output
        // Use verbose mode to enable Baileys logging only when explicitly requested
        const baileysLogger = this.config.verbose ? this.logger : silentLogger

        this.socket = makeWASocket({
            version,
            auth: {
                creds: this.authState.state.creds,
                keys: makeCacheableSignalKeyStore(this.authState.state.keys, baileysLogger)
            },
            printQRInTerminal: false, // We handle QR ourselves
            logger: baileysLogger,
            browser: ['WhatsApp-Claude-Agent', 'Desktop', '1.0.0'],
            generateHighQualityLinkPreview: false,
            syncFullHistory: false
        })

        this.setupEventHandlers()
    }

    private setupEventHandlers(): void {
        if (!this.socket || !this.authState) return

        const sock = this.socket
        const saveCreds = this.authState.saveCreds

        // Connection updates
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update

            if (qr) {
                this.logger.info('Scan QR code to authenticate:')
                qrcode.generate(qr, { small: true })
                this.emit('event', { type: 'qr', qr } as AgentEvent)
            }

            if (connection === 'close') {
                const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } })
                    ?.output?.statusCode
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut

                this.logger.warn(
                    `Connection closed. Status: ${statusCode}. Reconnecting: ${shouldReconnect}`
                )

                this.isReady = false
                this.emit('event', {
                    type: 'disconnected',
                    reason: `Status code: ${statusCode}`
                } as AgentEvent)

                if (shouldReconnect) {
                    this.logger.info('Attempting to reconnect...')
                    await this.connect()
                }
            }

            if (connection === 'open') {
                this.logger.info('WhatsApp connection established!')
                this.isReady = true
                this.emit('event', { type: 'authenticated' } as AgentEvent)

                // Join group if requested (only on first connection, not reconnects)
                if (this.config.joinWhatsAppGroup && !this.groupConfig) {
                    try {
                        await this.joinGroup(this.config.joinWhatsAppGroup)
                    } catch (error) {
                        const errorMsg = error instanceof Error ? error.message : String(error)
                        this.logger.error(`Failed to join group: ${errorMsg}`)
                        // Continue without group mode - will work in private mode
                    }
                }

                this.emit('event', { type: 'ready' } as AgentEvent)
            }
        })

        // Credentials update
        sock.ev.on('creds.update', saveCreds)

        // Message handling
        sock.ev.on('messages.upsert', async (upsert) => {
            for (const msg of upsert.messages) {
                await this.handleMessage(msg)
            }
        })
    }

    private async handleMessage(
        rawMsg: BaileysEventMap['messages.upsert']['messages'][0]
    ): Promise<void> {
        this.logger.debug(`Raw message received: ${JSON.stringify(rawMsg.key)}`)

        const msg = parseMessage(rawMsg)
        if (!msg) {
            this.logger.debug('Message parsing returned null (no text content)')
            return
        }

        this.logger.debug(
            `Parsed message: from=${msg.from}, participant=${msg.participant}, isGroupMessage=${msg.isGroupMessage}, text="${msg.text.slice(0, 30)}..."`
        )

        // Ignore messages that WE sent (bot responses) to prevent loops
        // We track message IDs when we send them
        if (this.sentMessageIds.has(msg.id)) {
            this.logger.debug('Ignoring message sent by this bot')
            this.sentMessageIds.delete(msg.id) // Clean up
            return
        }

        // Determine filtering logic based on group mode
        if (this.groupConfig) {
            // GROUP MODE: Only process messages from the joined group
            if (!msg.isGroupMessage) {
                this.logger.debug('Group mode active: Ignoring private message')
                return
            }

            if (msg.from !== this.groupConfig.groupJid) {
                this.logger.debug(
                    `Group mode active: Ignoring message from different group ${msg.from}`
                )
                return
            }

            // Check whitelist against PARTICIPANT (sender), not group JID
            if (!msg.participant) {
                this.logger.debug('Group message missing participant info')
                return
            }

            // Ignore messages from other agents (prefixed with [🤖)
            if (msg.text.startsWith('[🤖')) {
                this.logger.debug('Ignoring message from another agent')
                return
            }

            // Check whitelist unless allowAllGroupParticipants is enabled
            if (!this.config.allowAllGroupParticipants) {
                if (!isWhitelisted(msg.participant, this.config.whitelist)) {
                    this.logger.warn(
                        `Blocked group message from non-whitelisted participant: ${msg.participant}`
                    )
                    // Provide hint for @lid identifiers (WhatsApp privacy IDs used in groups)
                    if (msg.participant.endsWith('@lid')) {
                        const lidId = msg.participant.replace('@lid', '')
                        this.logger.info(
                            `Hint: This is a WhatsApp privacy ID (lid). If this is you, add "${lidId}" or "${msg.participant}" to your whitelist. ` +
                                `Note: lid IDs may change between sessions. Consider using --allow-all-group-participants instead.`
                        )
                    }
                    return
                }
                this.logger.debug(`Group message from whitelisted participant: ${msg.participant}`)
            } else {
                this.logger.debug(
                    `Group message from participant: ${msg.participant} (allowAllGroupParticipants enabled)`
                )
            }
        } else {
            // PRIVATE MODE: Original behavior - ignore groups, check whitelist
            if (msg.isGroupMessage) {
                this.logger.debug(`Ignoring group message from ${msg.from} (private mode active)`)
                return
            }

            if (!isWhitelisted(msg.from, this.config.whitelist)) {
                this.logger.warn(`Blocked message from non-whitelisted number: ${msg.from}`)
                return
            }
        }

        // Check if message is within threshold (for missed messages)
        if (msg.timestamp < this.startTime) {
            if (!this.config.processMissed) {
                this.logger.debug(`Ignoring old message (processMissed disabled)`)
                return
            }
            if (!isWithinThreshold(msg, this.config.missedThresholdMins)) {
                this.logger.debug(
                    `Ignoring old message (outside threshold of ${this.config.missedThresholdMins} mins)`
                )
                return
            }
            this.logger.info(`Processing missed message from ${msg.from}`)
        }

        const displayFrom = msg.participant || msg.from
        this.logger.info(
            `Message from ${displayFrom}: "${msg.text.slice(0, 50)}${msg.text.length > 50 ? '...' : ''}"`
        )
        this.emit('event', { type: 'message', message: msg } as AgentEvent)
    }

    async sendMessage(to: string, text: string): Promise<void> {
        if (!this.socket || !this.isReady) {
            throw new Error('WhatsApp client not ready')
        }

        // Prefix message with agent identity
        const prefixedText = formatMessageWithAgentName(this.config.agentIdentity, text)
        const chunks = chunkMessage(prefixedText)

        for (const chunk of chunks) {
            const result = await this.socket.sendMessage(to, { text: chunk })

            // Track the message ID so we don't process our own messages
            if (result?.key?.id) {
                this.sentMessageIds.add(result.key.id)
                // Clean up old IDs after 60 seconds to prevent memory leak
                setTimeout(() => this.sentMessageIds.delete(result.key.id!), 60000)
            }

            // Small delay between chunks to avoid rate limiting
            if (chunks.length > 1) {
                await new Promise((resolve) => setTimeout(resolve, 500))
            }
        }

        this.emit('event', {
            type: 'response',
            message: { to, text }
        } as AgentEvent)
    }

    async sendTyping(to: string): Promise<void> {
        if (!this.socket || !this.isReady) return
        await this.socket.sendPresenceUpdate('composing', to)
    }

    async sendStopTyping(to: string): Promise<void> {
        if (!this.socket || !this.isReady) return
        await this.socket.sendPresenceUpdate('paused', to)
    }

    async disconnect(): Promise<void> {
        if (this.socket) {
            this.socket.end(undefined)
            this.socket = null
        }
        this.isReady = false
    }

    get ready(): boolean {
        return this.isReady
    }

    /**
     * Join a WhatsApp group using invite code or URL
     * If already a member, retrieves group info instead of joining again
     */
    private async joinGroup(urlOrCode: string): Promise<void> {
        if (!this.socket || !this.isReady) {
            throw new Error('WhatsApp client not ready')
        }

        const inviteCode = extractGroupInviteCode(urlOrCode)
        this.logger.info(`Joining group with invite code: ${inviteCode}`)

        let groupJid: string | undefined

        try {
            // First, try to get invite info to check if we're already a member
            const inviteInfo = await this.socket.groupGetInviteInfo(inviteCode)

            if (inviteInfo) {
                // We got invite info - check if we're already in this group
                const potentialJid = inviteInfo.id
                this.logger.debug(`Group JID from invite: ${potentialJid}`)

                try {
                    // Try to get group metadata - if it succeeds, we're already a member
                    await this.socket.groupMetadata(potentialJid)
                    this.logger.info(`Already a member of group: ${potentialJid}`)
                    groupJid = potentialJid
                } catch {
                    // Not a member yet, proceed with joining
                    this.logger.debug(`Not yet a member, joining group...`)
                    groupJid = await this.socket.groupAcceptInvite(inviteCode)
                }
            }
        } catch {
            // groupGetInviteInfo failed, try direct join
            this.logger.debug(`Could not get invite info, attempting direct join`)
            try {
                groupJid = await this.socket.groupAcceptInvite(inviteCode)
            } catch (joinError) {
                const errorMsg = joinError instanceof Error ? joinError.message : String(joinError)
                // Check if error indicates we're already a member
                if (errorMsg.includes('already') || errorMsg.includes('conflict')) {
                    this.logger.warn(
                        `Join failed (possibly already a member). Use the group JID directly if known.`
                    )
                }
                throw joinError
            }
        }

        if (!groupJid) {
            throw new Error('Failed to join group: no group JID returned')
        }

        this.groupConfig = {
            groupJid,
            inviteCode
        }

        this.logger.info(`Successfully connected to group: ${groupJid}`)
        this.logger.info(
            `Agent is now listening ONLY to this group. Private messages will be ignored.`
        )
    }

    /**
     * Get current group config (if in group mode)
     */
    getGroupConfig(): GroupConfig | null {
        return this.groupConfig
    }
}
