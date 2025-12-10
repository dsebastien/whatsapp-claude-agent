import { EventEmitter } from 'events'
import { existsSync, statSync } from 'fs'
import { resolve } from 'path'
import { homedir } from 'os'
import { ConversationHistory } from './history.ts'
import { MessageQueue } from './queue.ts'
import type { ClaudeBackend } from '../claude/backend.ts'
import { PermissionManager } from '../claude/permissions.ts'
import { getModelShorthand } from '../claude/utils.ts'
import { isCommand, parseCommand } from '../whatsapp/messages.ts'
import type {
    Config,
    IncomingMessage,
    PermissionMode,
    SettingSource,
    AgentEvent
} from '../types.ts'
import type { Logger } from '../utils/logger.ts'

export class ConversationManager extends EventEmitter {
    private history: ConversationHistory
    private queue: MessageQueue
    private permissions: PermissionManager
    private backend: ClaudeBackend
    private config: Config
    private logger: Logger

    constructor(backend: ClaudeBackend, config: Config, logger: Logger) {
        super()
        this.backend = backend
        this.config = config
        this.logger = logger
        this.history = new ConversationHistory()
        this.queue = new MessageQueue(logger)
        this.permissions = new PermissionManager(logger)

        // Wire up permission requests
        this.backend.setPermissionCallback((toolName, description, input) =>
            this.permissions.requestPermission(toolName, description, input)
        )

        this.permissions.on('permission-request', (request) => {
            this.emit('event', { type: 'permission-request', request } as AgentEvent)
        })
    }

    /**
     * Handle an incoming message
     */
    async handleMessage(
        message: IncomingMessage,
        sendResponse: (text: string) => Promise<void>,
        sendTyping: () => Promise<void>
    ): Promise<void> {
        // Check if this is a permission response
        if (this.permissions.pendingCount > 0) {
            const resolved = this.permissions.tryResolveFromMessage(message.text)
            if (resolved) {
                return
            }
        }

        // Check for commands
        if (isCommand(message.text)) {
            await this.handleCommand(message, sendResponse)
            return
        }

        // Regular message - process with Claude
        await this.processWithClaude(message, sendResponse, sendTyping)
    }

    private async handleCommand(
        message: IncomingMessage,
        sendResponse: (text: string) => Promise<void>
    ): Promise<void> {
        const parsed = parseCommand(message.text)
        if (!parsed) return

        switch (parsed.command) {
            case 'clear':
                this.history.clear()
                await sendResponse('✓ Conversation cleared.')
                break

            case 'readonly':
            case 'plan':
                this.setMode('plan')
                await sendResponse('✓ Switched to *plan* mode. Claude can only read files.')
                break

            case 'normal':
            case 'default':
                this.setMode('default')
                await sendResponse(
                    '✓ Switched to *default* mode. Claude will ask permission for writes.'
                )
                break

            case 'acceptedits':
            case 'accept-edits':
                this.setMode('acceptEdits')
                await sendResponse(
                    '✓ Switched to *acceptEdits* mode. Claude can edit files without asking.'
                )
                break

            case 'yolo':
            case 'bypass':
            case 'bypasspermissions':
                this.setMode('bypassPermissions')
                await sendResponse(
                    '⚠️ Switched to *bypassPermissions* mode. Claude has full access without confirmation!'
                )
                break

            case 'dontask':
            case 'dont-ask':
                this.setMode('dontAsk')
                await sendResponse(
                    '✓ Switched to *dontAsk* mode. Claude will not prompt, denies if not pre-approved.'
                )
                break

            case 'mode':
                await sendResponse(`Current mode: *${this.config.mode}*`)
                break

            case 'help':
                await sendResponse(this.getHelpMessage())
                break

            case 'status':
                await sendResponse(this.getStatusMessage())
                break

            case 'systemprompt':
            case 'prompt':
                await this.handleSystemPromptCommand(parsed.args, sendResponse)
                break

            case 'promptappend':
            case 'appendprompt':
                await this.handlePromptAppendCommand(parsed.args, sendResponse)
                break

            case 'claudemd':
            case 'settings':
                await this.handleClaudeMdCommand(parsed.args, sendResponse)
                break

            case 'session':
                await this.handleSessionCommand(parsed.args, sendResponse)
                break

            case 'fork':
                await this.handleForkCommand(sendResponse)
                break

            case 'cd':
            case 'dir':
            case 'directory':
                await this.handleDirectoryCommand(parsed.args, sendResponse)
                break

            case 'model':
                await this.handleModelCommand(parsed.args, sendResponse)
                break

            case 'models':
                await this.handleModelsCommand(sendResponse)
                break

            default:
                await sendResponse(
                    `Unknown command: /${parsed.command}\n\nType /help for available commands.`
                )
        }
    }

    private async handleSystemPromptCommand(
        args: string,
        sendResponse: (text: string) => Promise<void>
    ): Promise<void> {
        if (!args) {
            const config = this.backend.getSystemPromptConfig()
            if (config.systemPrompt) {
                await sendResponse(
                    `*Current system prompt:*\n\n${config.systemPrompt.slice(0, 500)}${config.systemPrompt.length > 500 ? '...' : ''}`
                )
            } else if (config.systemPromptAppend) {
                await sendResponse(
                    `*System prompt append:*\n\n${config.systemPromptAppend.slice(0, 500)}${config.systemPromptAppend.length > 500 ? '...' : ''}`
                )
            } else {
                await sendResponse('Using default Claude Code system prompt.')
            }
            return
        }

        if (args.toLowerCase() === 'clear' || args.toLowerCase() === 'reset') {
            this.backend.setSystemPrompt(undefined)
            await sendResponse('✓ System prompt reset to default.')
            return
        }

        this.backend.setSystemPrompt(args)
        await sendResponse(`✓ System prompt set (${args.length} chars).`)
    }

    private async handlePromptAppendCommand(
        args: string,
        sendResponse: (text: string) => Promise<void>
    ): Promise<void> {
        if (!args) {
            const config = this.backend.getSystemPromptConfig()
            if (config.systemPromptAppend) {
                await sendResponse(
                    `*Current prompt append:*\n\n${config.systemPromptAppend.slice(0, 500)}${config.systemPromptAppend.length > 500 ? '...' : ''}`
                )
            } else {
                await sendResponse('No text appended to system prompt.')
            }
            return
        }

        if (args.toLowerCase() === 'clear' || args.toLowerCase() === 'reset') {
            this.backend.setSystemPromptAppend(undefined)
            await sendResponse('✓ Prompt append cleared.')
            return
        }

        this.backend.setSystemPromptAppend(args)
        await sendResponse(
            `✓ Text will be appended to default system prompt (${args.length} chars).`
        )
    }

    private async handleSessionCommand(
        args: string,
        sendResponse: (text: string) => Promise<void>
    ): Promise<void> {
        const currentSessionId = this.backend.getSessionId()

        if (!args) {
            // Show current session info
            if (currentSessionId) {
                await sendResponse(
                    `*Current Session:*\n\n\`${currentSessionId}\`\n\nUse this ID with \`--resume\` to continue this conversation later.`
                )
            } else {
                await sendResponse(
                    'No active session yet. Send a message to Claude to start a session.'
                )
            }
            return
        }

        if (args.toLowerCase() === 'clear' || args.toLowerCase() === 'new') {
            this.backend.setSessionId(undefined)
            this.history.clear()
            await sendResponse(
                '✓ Session cleared. A new session will be started on the next message.'
            )
            return
        }

        // Set a session ID for resumption
        this.backend.setSessionId(args)
        await sendResponse(
            `✓ Session set to: \`${args}\`\n\nNext message will resume this session.`
        )
    }

    private async handleForkCommand(sendResponse: (text: string) => Promise<void>): Promise<void> {
        const currentSessionId = this.backend.getSessionId()

        if (!currentSessionId) {
            await sendResponse(
                '❌ No active session to fork. Start a conversation first, then use /fork to branch it.'
            )
            return
        }

        // Enable forking for the next query
        this.backend.setForkSession(true)
        await sendResponse(
            `✓ Fork enabled for session \`${currentSessionId}\`.\n\nYour next message will create a new branch from this session. The original session remains unchanged.`
        )
    }

    private async handleDirectoryCommand(
        args: string,
        sendResponse: (text: string) => Promise<void>
    ): Promise<void> {
        if (!args) {
            // Show current working directory
            const currentDir = this.backend.getDirectory()
            await sendResponse(`📁 Working directory: \`${currentDir}\``)
            return
        }

        // Expand ~ to home directory
        let targetPath = args
        if (targetPath.startsWith('~')) {
            targetPath = resolve(homedir(), targetPath.slice(2))
        } else {
            targetPath = resolve(targetPath)
        }

        // Validate the path exists and is a directory
        if (!existsSync(targetPath)) {
            await sendResponse(`❌ Directory not found: \`${targetPath}\``)
            return
        }

        try {
            const stats = statSync(targetPath)
            if (!stats.isDirectory()) {
                await sendResponse(`❌ Path is not a directory: \`${targetPath}\``)
                return
            }
        } catch {
            await sendResponse(`❌ Cannot access path: \`${targetPath}\``)
            return
        }

        // Check if there's an active session - changing directory requires a new session
        const currentSessionId = this.backend.getSessionId()
        if (currentSessionId) {
            // Clear the session since it's tied to the old directory
            this.backend.setSessionId(undefined)
            this.history.clear()
            this.logger.info(
                `Session cleared due to directory change (sessions are tied to their original directory)`
            )
        }

        // Change the directory
        this.backend.setDirectory(targetPath)
        this.config.directory = targetPath

        let response = `✓ Working directory changed to: \`${targetPath}\``
        if (currentSessionId) {
            response +=
                '\n\n⚠️ Previous session was cleared (sessions are tied to their original directory). A new session will start with your next message.'
        }
        await sendResponse(response)
    }

    private async handleModelCommand(
        args: string,
        sendResponse: (text: string) => Promise<void>
    ): Promise<void> {
        if (!args) {
            // Show current model
            const currentModel = this.backend.getModel()
            await sendResponse(
                `🤖 Current model: \`${currentModel}\`\n\nUse /models to see available models.\nShorthands: opus, sonnet, haiku, opus-4.5, sonnet-4, etc.`
            )
            return
        }

        const requestedInput = args.trim()

        // Resolve shorthand to full model ID (returns undefined if not recognized)
        const resolvedModel = this.backend.resolveModelShorthand(requestedInput)

        // If not recognized, don't change the model
        if (!resolvedModel) {
            await sendResponse(
                `❌ Unknown model: \`${requestedInput}\`\n\nUse /models to see available models.\nShorthands: opus, sonnet, haiku, opus-4.5, sonnet-4, etc.`
            )
            return
        }

        // Check if there's an active session - changing model may require a new session
        const currentSessionId = this.backend.getSessionId()
        if (currentSessionId) {
            // Clear the session since changing model may affect context
            this.backend.setSessionId(undefined)
            this.history.clear()
            this.logger.info('Session cleared due to model change')
        }

        // Change the model
        this.backend.setModel(resolvedModel)
        this.config.model = resolvedModel

        let response =
            requestedInput !== resolvedModel
                ? `✓ Model changed to: \`${resolvedModel}\` (from "${requestedInput}")`
                : `✓ Model changed to: \`${resolvedModel}\``
        if (currentSessionId) {
            response +=
                '\n\n⚠️ Previous session was cleared. A new session will start with your next message.'
        }
        await sendResponse(response)
    }

    private async handleModelsCommand(
        sendResponse: (text: string) => Promise<void>
    ): Promise<void> {
        const availableModels = this.backend.getAvailableModels()
        const currentModel = this.backend.getModel()

        const modelList = availableModels
            .map((m) => {
                const shorthand = getModelShorthand(m)
                const displayName = shorthand ? `${shorthand} (${m})` : m
                return m === currentModel
                    ? `• \`${displayName}\` ✓ (current)`
                    : `• \`${displayName}\``
            })
            .join('\n')

        await sendResponse(
            `*Available Models:*\n\n${modelList}\n\nUse \`/model <shorthand>\` to switch (e.g., \`/model opus-4-5\`).`
        )
    }

    private async handleClaudeMdCommand(
        args: string,
        sendResponse: (text: string) => Promise<void>
    ): Promise<void> {
        const validSources: SettingSource[] = ['user', 'project', 'local']

        if (!args) {
            const sources = this.backend.getSettingSources()
            if (sources && sources.length > 0) {
                await sendResponse(`*CLAUDE.md sources:* ${sources.join(', ')}`)
            } else {
                await sendResponse(
                    'No CLAUDE.md sources configured. Use `/claudemd user,project` to enable.'
                )
            }
            return
        }

        if (args.toLowerCase() === 'clear' || args.toLowerCase() === 'none') {
            this.backend.setSettingSources(undefined)
            await sendResponse('✓ CLAUDE.md loading disabled.')
            return
        }

        const requestedSources = args
            .split(',')
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.length > 0)

        const invalid = requestedSources.filter((s) => !validSources.includes(s as SettingSource))
        if (invalid.length > 0) {
            await sendResponse(
                `❌ Invalid sources: ${invalid.join(', ')}\n\nValid sources: user, project, local`
            )
            return
        }

        this.backend.setSettingSources(requestedSources as SettingSource[])
        await sendResponse(`✓ CLAUDE.md sources set to: ${requestedSources.join(', ')}`)
    }

    private async processWithClaude(
        message: IncomingMessage,
        sendResponse: (text: string) => Promise<void>,
        sendTyping: () => Promise<void>
    ): Promise<void> {
        this.logger.info('Processing message with Claude...')

        // Indicate typing
        await sendTyping()

        // Add to history
        this.history.addUserMessage(message)

        try {
            // Query Claude
            this.logger.info('Sending query to Claude backend...')
            const response = await this.backend.query(message.text, this.history.getHistory())
            this.logger.info(`Claude response received (${response.text.length} chars)`)

            if (response.error) {
                await sendResponse(`❌ Error: ${response.error}`)
                return
            }

            // Add response to history
            this.history.addAssistantMessage(response.text)

            // Log tools used (verbose only)
            if (response.toolsUsed && response.toolsUsed.length > 0) {
                this.logger.debug(`Tools used: ${response.toolsUsed.join(', ')}`)
            }

            await sendResponse(response.text)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            this.logger.error(`Error processing message: ${errorMessage}`)
            await sendResponse(`❌ An error occurred: ${errorMessage}`)
        }
    }

    private setMode(mode: PermissionMode): void {
        this.config.mode = mode
        this.backend.setMode(mode)
        this.logger.info(`Mode changed to: ${mode}`)
    }

    /**
     * Resolve a pending permission request
     */
    resolvePermission(requestId: string, allowed: boolean): boolean {
        return this.permissions.resolvePermission(requestId, allowed)
    }

    private getHelpMessage(): string {
        return `*Available Commands:*

*Session & Directory:*
/clear - Clear conversation history
/status - Show agent status
/session - Show current session ID
/session <id> - Set session ID to resume
/session clear - Start a new session
/fork - Fork current session (branch off)
/cd - Show current working directory
/cd <path> - Change working directory
/help - Show this help message

*Model:*
/model - Show current model
/model <name> - Switch to a different model
/models - List all available models

*Permission Modes:*
/mode - Show current permission mode
/plan - Switch to plan mode (read-only)
/default - Switch to default mode (asks for permission)
/acceptEdits - Auto-accept file edits
/bypass - Bypass all permissions (dangerous!)
/dontAsk - Deny if not pre-approved

*System Prompt:*
/prompt - Show current system prompt
/prompt <text> - Set custom system prompt
/prompt clear - Reset to default
/promptappend <text> - Append to default prompt
/promptappend clear - Clear append

*CLAUDE.md Settings:*
/claudemd - Show current sources
/claudemd user,project - Load user & project CLAUDE.md
/claudemd clear - Disable CLAUDE.md loading

*Valid CLAUDE.md sources:* user, project, local`
    }

    private getStatusMessage(): string {
        const promptConfig = this.backend.getSystemPromptConfig()
        const sources = this.backend.getSettingSources()
        const sessionId = this.backend.getSessionId()

        let promptStatus = 'default'
        if (promptConfig.systemPrompt) {
            promptStatus = `custom (${promptConfig.systemPrompt.length} chars)`
        } else if (promptConfig.systemPromptAppend) {
            promptStatus = `default + append (${promptConfig.systemPromptAppend.length} chars)`
        }

        const claudeMdStatus = sources?.length ? sources.join(', ') : 'disabled'
        const sessionStatus = sessionId ? `\`${sessionId}\`` : 'none (new session)'

        return `*Agent Status:*

📁 Working directory: \`${this.config.directory}\`
🔐 Mode: ${this.config.mode}
🤖 Model: ${this.config.model}
🔗 Session: ${sessionStatus}
💬 Conversation length: ${this.history.length} messages
⏳ Pending permissions: ${this.permissions.pendingCount}
📝 System prompt: ${promptStatus}
📄 CLAUDE.md sources: ${claudeMdStatus}`
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        this.permissions.cancelAll()
        this.queue.clear()
        this.history.clear()
    }
}
