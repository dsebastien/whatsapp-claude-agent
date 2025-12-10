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
import { isWhitelisted, isGroupJid } from '../utils/phone.ts'
import type { Logger } from '../utils/logger.ts'
import type { Config, AgentEvent } from '../types.ts'

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
            `Parsed message: from=${msg.from}, isFromMe=${msg.isFromMe}, text="${msg.text.slice(0, 30)}..."`
        )

        // Ignore messages that WE sent (bot responses) to prevent loops
        // We track message IDs when we send them
        if (this.sentMessageIds.has(msg.id)) {
            this.logger.debug('Ignoring message sent by this bot')
            this.sentMessageIds.delete(msg.id) // Clean up
            return
        }

        // Ignore group messages
        if (isGroupJid(msg.from)) {
            this.logger.debug(`Ignoring group message from ${msg.from}`)
            return
        }

        // Check whitelist
        if (!isWhitelisted(msg.from, this.config.whitelist)) {
            this.logger.warn(`Blocked message from non-whitelisted number: ${msg.from}`)
            return
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

        this.logger.info(
            `Message from ${msg.from}: "${msg.text.slice(0, 50)}${msg.text.length > 50 ? '...' : ''}"`
        )
        this.emit('event', { type: 'message', message: msg } as AgentEvent)
    }

    async sendMessage(to: string, text: string): Promise<void> {
        if (!this.socket || !this.isReady) {
            throw new Error('WhatsApp client not ready')
        }

        const chunks = chunkMessage(text)

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
}
