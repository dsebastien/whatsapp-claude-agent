# Configuration

## Required Options

**`whitelist`** — MANDATORY. App exits if not provided via CLI (`-w`) or config file. Must contain at least one phone number.

## CLI Config Management

Manage config without running agent via `config` subcommand:

```bash
# Initialize new config
whatsapp-claude-agent config init "+1234567890"
whatsapp-claude-agent config init "+111,+222"         # multiple numbers
whatsapp-claude-agent config init "+111" --force      # overwrite existing

# View config
whatsapp-claude-agent config show              # human-readable (alias: list)
whatsapp-claude-agent config show --json       # JSON output
whatsapp-claude-agent config export            # JSON to stdout

# Get/set individual values
whatsapp-claude-agent config get model
whatsapp-claude-agent config set model opus
whatsapp-claude-agent config set whitelist "+111,+222"
whatsapp-claude-agent config set verbose true
whatsapp-claude-agent config unset maxTurns   # alias: delete

# Import config
whatsapp-claude-agent config import '{"model":"opus"}'         # JSON string
whatsapp-claude-agent config import config.backup.json         # from file
whatsapp-claude-agent config import config.backup.json --merge # merge with existing

# Specify config location
whatsapp-claude-agent config -d /path/to/project show
whatsapp-claude-agent config -c /custom/path.json set model haiku
```

Valid keys for set/get: whitelist, directory, mode, sessionPath, model, maxTurns, processMissed, missedThresholdMins, verbose, agentName, systemPrompt, systemPromptAppend, settingSources

## Sources (Priority Order)

1. **CLI arguments** (highest) — override everything
2. **Config file** — `{directory}/.whatsapp-claude-agent.json` (working directory)
3. **Built-in defaults** (lowest)

## Config File Location

Config is loaded from the working directory: `{directory}/.whatsapp-claude-agent.json`

Specify custom path: `-c, --config <path>`

## Schema

Defined in `src/types.ts` via Zod:

```typescript
// Agent identity with separate components
AgentIdentitySchema = z.object({
    name: z.string(), // The agent's name (superhero name or custom)
    host: z.string(), // Hostname where agent runs
    folder: z.string() // Working directory basename
})

ConfigSchema = z.object({
    directory: z.string().default(process.cwd()),
    mode: PermissionModeSchema.default('default'),
    whitelist: z.array(z.string()).min(1),
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
    agentName: z.string().optional(), // Custom name (overrides generated)
    agentIdentity: AgentIdentitySchema, // Full identity with components
    joinWhatsAppGroup: z.string().optional(),
    allowAllGroupParticipants: z.boolean().default(false)
})
```

## CLI to Config Mapping

| CLI                              | Config Property             |
| -------------------------------- | --------------------------- |
| `-d, --directory`                | `directory`                 |
| `-m, --mode`                     | `mode`                      |
| `-w, --whitelist`                | `whitelist`                 |
| `-s, --session`                  | `sessionPath`               |
| `--model`                        | `model`                     |
| `--max-turns`                    | `maxTurns`                  |
| `--process-missed`               | `processMissed`             |
| `--missed-threshold`             | `missedThresholdMins`       |
| `-v, --verbose`                  | `verbose`                   |
| `--system-prompt`                | `systemPrompt`              |
| `--system-prompt-append`         | `systemPromptAppend`        |
| `--load-claude-md`               | `settingSources`            |
| `--resume`                       | `resumeSessionId`           |
| `--fork`                         | `forkSession`               |
| `--agent-name`                   | `agentName`                 |
| `--join-whatsapp-group`          | `joinWhatsAppGroup`         |
| `--allow-all-group-participants` | `allowAllGroupParticipants` |

## Save/Load Functions

```typescript
// src/cli/config.ts

loadConfigFile(configPath?: string, directory?: string): Partial<Config>
// Loads from configPath or {directory}/.whatsapp-claude-agent.json

saveConfigFile(config: Config, configPath?: string): string
// Saves to path or {config.directory}/.whatsapp-claude-agent.json
// Returns saved path

getLocalConfigPath(directory?: string): string
// {directory}/.whatsapp-claude-agent.json

generateConfigTemplate(whitelist: string[]): string
// Returns JSON string for template
```

## Saveable vs Runtime Properties

Only persistent properties saved to file (defined in `SAVEABLE_KEYS` in `src/cli/config.ts`):

- whitelist, directory, mode, sessionPath, model, maxTurns
- processMissed, missedThresholdMins, verbose, agentName
- systemPrompt, systemPromptAppend, settingSources

Runtime-only (not saved):

- resumeSessionId, forkSession, joinWhatsAppGroup, allowAllGroupParticipants

## Adding New Config Options

1. Add to `ConfigSchema` in `src/types.ts`
2. Add CLI option in `src/cli/commands.ts`
3. Add merge logic in `parseConfig()` in `src/cli/config.ts`
4. If saveable, add to `SAVEABLE_KEYS` array
5. Update README config table
