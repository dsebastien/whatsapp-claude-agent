import { Command } from 'commander'
import { version } from '../../package.json'
import { buildInfo, getBuildInfoString } from '../build-info.ts'
import { loadConfigFile, parseConfig, type CLIOptions } from './config.ts'
import { createConfigCommand } from './config-commands.ts'
import type { Config } from '../types.ts'

export function createCLI(): Command {
    const program = new Command()

    // Use build-time version if available (from --define), otherwise use package.json
    const displayVersion = buildInfo.version !== '0.0.0-dev' ? buildInfo.version : version

    program
        .name('whatsapp-claude-agent')
        .description(
            'Bridge WhatsApp with Claude Code - interact with your files via WhatsApp messages'
        )
        .version(displayVersion, '-V, --version', 'Output the version number')
        .enablePositionalOptions()
        .passThroughOptions()
        .addHelpText('after', `\nBuild: ${getBuildInfoString()}`)
        .addHelpText(
            'after',
            `
Examples:
  $ whatsapp-claude-agent -w "+1234567890"
  $ whatsapp-claude-agent -w "+1234567890,+0987654321" -d ./my-project
  $ whatsapp-claude-agent -w "+1234567890" -m plan --verbose
  $ whatsapp-claude-agent -c ~/.config/whatsapp-claude-agent/config.json
  $ whatsapp-claude-agent -w "+1234567890" --resume <session-id>
  $ whatsapp-claude-agent -w "+1234567890" --resume <session-id> --fork
  $ whatsapp-claude-agent -w "+1234567890" --join-whatsapp-group "https://chat.whatsapp.com/XXX"

Config Management (without running agent):
  $ whatsapp-claude-agent config init "+1234567890"
  $ whatsapp-claude-agent config show
  $ whatsapp-claude-agent config set model opus
  $ whatsapp-claude-agent config get whitelist`
        )

    // Add config subcommand
    program.addCommand(createConfigCommand())

    program
        .option(
            '-d, --directory <path>',
            'Working directory for Claude (default: current directory)'
        )
        .option(
            '-m, --mode <mode>',
            'Permission mode: "default", "acceptEdits", "bypassPermissions", "plan", or "dontAsk"',
            'default'
        )
        .option(
            '-w, --whitelist <numbers>',
            'Comma-separated phone numbers allowed to interact (required, e.g., "+1234567890")'
        )
        .option(
            '-s, --session <path>',
            'WhatsApp session directory',
            '~/.whatsapp-claude-agent/session'
        )
        .option('--model <model>', 'Claude model to use', 'claude-sonnet-4-20250514')
        .option('--max-turns <n>', 'Maximum conversation turns')
        .option('--process-missed', 'Process messages received while offline', true)
        .option('--no-process-missed', 'Ignore messages received while offline')
        .option('--missed-threshold <mins>', 'Only process messages from last N minutes', '60')
        .option('-v, --verbose', 'Enable verbose logging', false)
        .option('-c, --config <path>', 'Path to config file')
        .option('--system-prompt <prompt>', 'Custom system prompt for Claude (replaces default)')
        .option(
            '--system-prompt-append <text>',
            'Text to append to the default Claude Code system prompt'
        )
        .option(
            '--load-claude-md <sources>',
            'Comma-separated list of CLAUDE.md sources to load: "user", "project", "local" (e.g., "user,project")'
        )
        .option('--resume <sessionId>', 'Resume a previous Claude session by its session ID')
        .option(
            '--fork',
            'When resuming, fork the session instead of continuing it (creates a new session ID)',
            false
        )
        .option(
            '--agent-name <name>',
            'Agent identity name used to prefix messages (default: auto-generated from hostname + directory + superhero)'
        )
        .option(
            '--join-whatsapp-group <url-or-code>',
            'Join and listen to a WhatsApp group (URL: https://chat.whatsapp.com/XXX or code: XXX). When specified, agent listens ONLY to this group, not private messages.'
        )
        .option(
            '--allow-all-group-participants',
            'In group mode, allow messages from all participants (bypasses whitelist). Messages from other agents are still ignored.',
            false
        )
        // Allow running without subcommand (main agent mode)
        .action(() => {
            // No-op: parsing continues, main() in index.ts handles the rest
        })

    return program
}

/**
 * Check if args contain a subcommand that doesn't require the agent to run
 */
export function isConfigSubcommand(args: string[]): boolean {
    return args.includes('config')
}

/**
 * Run the config subcommand and exit
 */
export function runConfigSubcommand(args: string[]): never {
    const program = createCLI()
    program.parse(args)
    // If we get here, the subcommand handled everything
    process.exit(0)
}

export function parseArgs(args: string[]): Config {
    const program = createCLI()
    program.parse(args)
    const options = program.opts<CLIOptions>()

    // Check for whitelist - it can come from CLI or config file in working directory
    const directory = options.directory || process.cwd()
    const fileConfig = loadConfigFile(options.config, directory)
    const hasWhitelist = options.whitelist || fileConfig.whitelist

    if (!hasWhitelist) {
        console.error(`Error: Missing required option '--whitelist'

The whitelist specifies which phone numbers can interact with Claude.
This is a security feature to prevent unauthorized access.

Usage:
  whatsapp-claude-agent -w "+1234567890"
  whatsapp-claude-agent -w "+1234567890,+0987654321"

Or set it in a config file:
  {
    "whitelist": ["+1234567890"]
  }

Run 'whatsapp-claude-agent --help' for more information.
`)
        process.exit(1)
    }

    try {
        return parseConfig(options)
    } catch (error) {
        if (error instanceof Error) {
            console.error(`Error: ${error.message}`)
        } else {
            console.error('Error: An unknown error occurred')
        }
        process.exit(1)
    }
}
