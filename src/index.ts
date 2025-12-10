#!/usr/bin/env bun
import { parseArgs, isConfigSubcommand, runConfigSubcommand } from './cli/commands.ts'
import { createLogger } from './utils/logger.ts'
import { WhatsAppClient } from './whatsapp/client.ts'
import { SDKBackend } from './claude/sdk-backend.ts'
import { ConversationManager } from './conversation/manager.ts'
import { phoneToJid } from './utils/phone.ts'
import type { Config, AgentEvent, IncomingMessage, PermissionRequest } from './types.ts'

async function main() {
    // Handle config subcommand without running agent
    if (isConfigSubcommand(process.argv)) {
        runConfigSubcommand(process.argv)
    }

    // Parse command line arguments
    let config: Config
    try {
        config = parseArgs(process.argv)
    } catch (error) {
        console.error(error instanceof Error ? error.message : error)
        process.exit(1)
    }

    // Create logger
    const logger = createLogger(config.verbose)

    logger.info('Starting WhatsApp Claude Agent...')
    logger.info(
        `Agent: ${config.agentIdentity.name}@${config.agentIdentity.host} ${config.agentIdentity.folder}/`
    )
    logger.info(`Working directory: ${config.directory}`)
    logger.info(`Mode: ${config.mode}`)
    logger.info(`Whitelisted numbers: ${config.whitelist.join(', ')}`)
    if (config.resumeSessionId) {
        logger.info(
            `Resuming session: ${config.resumeSessionId}${config.forkSession ? ' (forking)' : ''}`
        )
        logger.warn(
            '⚠️  Note: Sessions are tied to the directory they were created in. ' +
                'If you specify a different directory with -d, the session will fail to resume ' +
                'and a new session will be started instead.'
        )
    }
    if (config.joinWhatsAppGroup) {
        logger.info(`Group mode enabled: will join group ${config.joinWhatsAppGroup}`)
        logger.info('Agent will listen ONLY to this group and ignore private messages.')
        if (config.allowAllGroupParticipants) {
            logger.warn(
                '⚠️  --allow-all-group-participants is set: whitelist will be ignored. ' +
                    'Any group member can interact with this agent.'
            )
        }
    }

    // Create Claude backend
    const backend = new SDKBackend(config, logger)

    // Set up session callback to log session info with usage instructions
    const executableName = process.argv[1]
        ? process.argv[1].split('/').pop()
        : 'whatsapp-claude-agent'
    backend.setSessionCallback((sessionId: string) => {
        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        logger.info(`Session ID: ${sessionId}`)
        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        logger.info('To resume this session later:')
        logger.info(`  ${executableName} -w "${config.whitelist[0]}" --resume ${sessionId}`)
        logger.info('')
        logger.info('To fork this session (create a new branch):')
        logger.info(`  ${executableName} -w "${config.whitelist[0]}" --resume ${sessionId} --fork`)
        logger.info('')
        logger.info('Or use WhatsApp commands: /session, /fork')
        logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    })

    // Create WhatsApp client
    const whatsapp = new WhatsAppClient(config, logger)

    // Create conversation manager
    const conversation = new ConversationManager(backend, config, logger)

    // Inject WhatsApp client reference into conversation manager (for group config access)
    conversation.setWhatsAppClient(whatsapp)

    // Track the current message sender for permission requests
    let currentSenderJid: string | null = null

    // Set up event handlers
    whatsapp.on('event', async (event: AgentEvent) => {
        switch (event.type) {
            case 'qr':
                logger.info('QR code displayed. Please scan with WhatsApp.')
                break

            case 'authenticated':
                logger.info('WhatsApp authenticated successfully!')
                break

            case 'ready':
                logger.info('WhatsApp client ready. Listening for messages...')
                // Send startup announcement to all whitelisted numbers
                await sendStartupAnnouncement()
                break

            case 'message':
                await handleMessage(event.message)
                break

            case 'disconnected':
                logger.warn(`Disconnected: ${event.reason}`)
                break

            case 'error':
                logger.error(`Error: ${event.error.message}`)
                break
        }
    })

    // Handle permission requests from conversation manager
    conversation.on('event', async (event: AgentEvent) => {
        if (event.type === 'permission-request') {
            await handlePermissionRequest(event.request)
        }
    })

    async function sendStartupAnnouncement() {
        const groupConfig = whatsapp.getGroupConfig()
        const { name, host } = config.agentIdentity

        if (groupConfig) {
            // Group mode: Send announcement to the group
            const announcement = `Now online!

🤖 Name: *${name}*
🖥️ Host: ${host}
📁 Directory: ${config.directory}
🔐 Mode: ${config.mode}
🧠 Model: ${config.model}
👥 Chat: Group

*Target me with:*
• @${name} <message>
• @ai <message>
• @agent <message>
• /ask <message>

Check if online: */agent*`

            try {
                await whatsapp.sendMessage(groupConfig.groupJid, announcement)
                logger.info(`Startup announcement sent to group ${groupConfig.groupJid}`)
            } catch (error) {
                logger.error(`Failed to send startup announcement to group: ${error}`)
            }
        } else {
            // Private mode: Send announcement to all whitelisted numbers
            const announcement = `Now online!

🤖 Name: *${name}*
🖥️ Host: ${host}
📁 Directory: ${config.directory}
🔐 Mode: ${config.mode}
🧠 Model: ${config.model}
💬 Chat: Private

Type */help* for available commands.`

            for (const phone of config.whitelist) {
                const jid = phoneToJid(phone)
                try {
                    await whatsapp.sendMessage(jid, announcement)
                    logger.info(`Startup announcement sent to ${phone}`)
                } catch (error) {
                    logger.error(`Failed to send startup announcement to ${phone}: ${error}`)
                }
            }
        }
    }

    async function handleMessage(message: IncomingMessage) {
        logger.debug(`Processing message from ${message.from}`)

        // Track sender for permission requests
        currentSenderJid = message.from

        await conversation.handleMessage(
            message,
            async (text) => {
                await whatsapp.sendMessage(message.from, text)
            },
            async () => {
                await whatsapp.sendTyping(message.from)
            }
        )

        // Clear sender after handling
        currentSenderJid = null
    }

    async function handlePermissionRequest(request: PermissionRequest) {
        // Send permission request to the user who initiated the conversation
        // whitelist[0] is guaranteed to exist by ConfigSchema validation (min 1 required)
        const groupConfig = whatsapp.getGroupConfig()
        const jid = groupConfig
            ? groupConfig.groupJid
            : currentSenderJid || phoneToJid(config.whitelist[0]!)

        logger.info(`Sending permission request to ${jid} for tool: ${request.toolName}`)

        const { name } = config.agentIdentity
        let replyInstructions: string
        if (groupConfig) {
            // Group mode: require targeting
            replyInstructions = `Reply with *@${name} Y* to allow or *@${name} N* to deny.
(Also works: @ai Y/N, @agent Y/N)`
        } else {
            // Private mode: simple Y/N
            replyInstructions = `Reply *Y* to allow or *N* to deny.`
        }

        const permMessage = `🔐 *Permission Request*

Claude wants to use *${request.toolName}*:

\`\`\`
${request.description}
\`\`\`

${replyInstructions}
(Auto-denies in 5 minutes)`

        try {
            await whatsapp.sendMessage(jid, permMessage)
            logger.info(`Permission request sent successfully to ${jid}`)
        } catch (error) {
            logger.error(`Failed to send permission request: ${error}`)
        }
    }

    // Handle graceful shutdown
    const shutdown = async () => {
        logger.info('\nShutting down...')

        conversation.dispose()
        await backend.stop()
        await whatsapp.disconnect()

        logger.info('Goodbye!')
        process.exit(0)
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    // Connect to WhatsApp
    try {
        await whatsapp.connect()
    } catch (error) {
        logger.error(`Failed to connect: ${error}`)
        process.exit(1)
    }
}

main().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
})
