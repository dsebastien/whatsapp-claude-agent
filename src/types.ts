import { z } from 'zod'
import type { PermissionMode as SDKPermissionMode } from '@anthropic-ai/claude-agent-sdk'

// Re-export SDK's PermissionMode type for use throughout the app
export type PermissionMode = SDKPermissionMode

// Zod schema for runtime validation - aligns with SDK's PermissionMode
export const PermissionModeSchema = z.enum([
    'default',
    'acceptEdits',
    'bypassPermissions',
    'plan',
    'dontAsk'
])

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
    systemPromptAppend: z.string().optional()
})

export type Config = z.infer<typeof ConfigSchema>

export interface IncomingMessage {
    id: string
    from: string
    text: string
    timestamp: Date
    isFromMe: boolean
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
