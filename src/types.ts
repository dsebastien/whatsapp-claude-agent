import { z } from 'zod'
import type {
    PermissionMode as SDKPermissionMode,
    SettingSource as SDKSettingSource
} from '@anthropic-ai/claude-agent-sdk'

// Re-export SDK's PermissionMode type for use throughout the app
export type PermissionMode = SDKPermissionMode

// Re-export SDK's SettingSource type for use throughout the app
export type SettingSource = SDKSettingSource

// Zod schema for runtime validation - aligns with SDK's PermissionMode
export const PermissionModeSchema = z.enum([
    'default',
    'acceptEdits',
    'bypassPermissions',
    'plan',
    'dontAsk'
])

// Zod schema for runtime validation - aligns with SDK's SettingSource
export const SettingSourceSchema = z.enum(['user', 'project', 'local'])

export const ConfigSchema = z.object({
    directory: z.string().default(process.cwd()),
    mode: PermissionModeSchema.default('default'),
    whitelist: z.array(z.string()).min(1, 'At least one whitelisted number required'),
    sessionPath: z.string().default('~/.whatsapp-claude-agent/session'),
    model: z.string().default('claude-sonnet-4-20250514'),
    maxTurns: z.number().optional(),
    processMissed: z.boolean().default(true),
    missedThresholdMins: z.number().default(60),
    verbose: z.boolean().default(false),
    systemPrompt: z.string().optional(),
    systemPromptAppend: z.string().optional(),
    settingSources: z.array(SettingSourceSchema).optional(),
    resumeSessionId: z.string().optional(),
    forkSession: z.boolean().default(false),
    agentName: z.string(), // Will be set with a default value during config parsing
    joinWhatsAppGroup: z.string().optional(), // Runtime-only: WhatsApp group to join
    allowAllGroupParticipants: z.boolean().default(false) // Runtime-only: bypass whitelist in group mode
})

export type Config = z.infer<typeof ConfigSchema>

export interface IncomingMessage {
    id: string
    from: string
    text: string
    timestamp: Date
    isFromMe: boolean
    participant?: string // Sender JID in group messages (undefined for private chats)
    isGroupMessage: boolean
}

export interface GroupConfig {
    groupJid: string // The group JID we're listening to
    inviteCode: string // Original invite code (for logging)
}

export interface OutgoingMessage {
    to: string
    text: string
    replyTo?: string
}

export interface PermissionRequest {
    id: string
    toolName: string
    description: string
    input: unknown
    resolve: (allowed: boolean) => void
}

export type AgentEvent =
    | { type: 'qr'; qr: string }
    | { type: 'authenticated' }
    | { type: 'ready' }
    | { type: 'message'; message: IncomingMessage }
    | { type: 'response'; message: OutgoingMessage }
    | { type: 'permission-request'; request: PermissionRequest }
    | { type: 'error'; error: Error }
    | { type: 'disconnected'; reason: string }
