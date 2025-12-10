import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { resolve } from 'path'
import { ConfigSchema, type Config } from '../types.ts'

const CONFIG_FILE_NAME = 'config.json'

function expandPath(path: string): string {
    if (path.startsWith('~')) {
        return resolve(homedir(), path.slice(2))
    }
    return resolve(path)
}

function getDefaultConfigPath(): string {
    return resolve(homedir(), '.whatsapp-claude-agent', CONFIG_FILE_NAME)
}

export function loadConfigFile(configPath?: string): Partial<Config> {
    const path = configPath || getDefaultConfigPath()
    const expandedPath = expandPath(path)

    if (!existsSync(expandedPath)) {
        return {}
    }

    try {
        const content = readFileSync(expandedPath, 'utf-8')
        return JSON.parse(content) as Partial<Config>
    } catch {
        console.warn(`Warning: Could not parse config file at ${expandedPath}`)
        return {}
    }
}

export interface CLIOptions {
    directory?: string
    mode?: string
    whitelist?: string
    session?: string
    model?: string
    maxTurns?: string
    processMissed?: boolean
    missedThreshold?: string
    verbose?: boolean
    config?: string
    systemPrompt?: string
    systemPromptAppend?: string
}

export function parseConfig(cliOptions: CLIOptions): Config {
    // Load config file first (lowest priority)
    const fileConfig = loadConfigFile(cliOptions.config)

    // Build merged config (CLI options override file config)
    const merged = {
        directory: cliOptions.directory || fileConfig.directory,
        mode: cliOptions.mode || fileConfig.mode,
        whitelist: cliOptions.whitelist
            ? cliOptions.whitelist.split(',').map((n) => n.trim())
            : fileConfig.whitelist,
        sessionPath: cliOptions.session
            ? expandPath(cliOptions.session)
            : fileConfig.sessionPath
              ? expandPath(fileConfig.sessionPath)
              : undefined,
        model: cliOptions.model || fileConfig.model,
        maxTurns: cliOptions.maxTurns ? parseInt(cliOptions.maxTurns, 10) : fileConfig.maxTurns,
        processMissed: cliOptions.processMissed ?? fileConfig.processMissed,
        missedThresholdMins: cliOptions.missedThreshold
            ? parseInt(cliOptions.missedThreshold, 10)
            : fileConfig.missedThresholdMins,
        verbose: cliOptions.verbose ?? fileConfig.verbose,
        systemPrompt: cliOptions.systemPrompt || fileConfig.systemPrompt,
        systemPromptAppend: cliOptions.systemPromptAppend || fileConfig.systemPromptAppend
    }

    // Filter out undefined values
    const filtered = Object.fromEntries(Object.entries(merged).filter(([_, v]) => v !== undefined))

    // Validate and apply defaults
    const result = ConfigSchema.safeParse(filtered)

    if (!result.success) {
        const errors = result.error.issues
            .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
            .join('\n')
        throw new Error(`Configuration validation failed:\n${errors}`)
    }

    // Expand paths in the final config
    const config = result.data
    config.directory = expandPath(config.directory)
    config.sessionPath = expandPath(config.sessionPath)

    return config
}
