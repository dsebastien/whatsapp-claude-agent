# WhatsApp Commands

All commands start with `/`. Parsed in `src/whatsapp/messages.ts`, handled in `src/conversation/manager.ts`.

## Command Structure

```typescript
// Detection
isCommand(text: string): boolean  // checks for '/' prefix

// Parsing
parseCommand(text: string): { command: string; args: string } | null
// "/model opus" → { command: "model", args: "opus" }
```

## Session & Directory

| Command                          | Handler                    | Effect                                         |
| -------------------------------- | -------------------------- | ---------------------------------------------- |
| `/agent`                         | `getAgentInfoMessage()`    | Check if agent is online, show basic info      |
| `/clear`                         | inline                     | Clears conversation history                    |
| `/status`                        | `getStatusMessage()`       | Shows detailed agent status                    |
| `/session [id]`                  | `handleSessionCommand()`   | Show/set session ID                            |
| `/session clear`, `/session new` | `handleSessionCommand()`   | Start new session                              |
| `/fork`                          | `handleForkCommand()`      | Fork current session                           |
| `/cd [path]`                     | `handleDirectoryCommand()` | Show/change working directory (clears session) |
| `/dir`, `/directory`             | (aliases for `/cd`)        | —                                              |
| `/help`                          | `getHelpMessage()`         | Show all commands                              |

## Agent & Model

| Command                     | Handler                 | Effect                               |
| --------------------------- | ----------------------- | ------------------------------------ |
| `/name [name]`              | `handleNameCommand()`   | Show/set agent name                  |
| `/agentname`, `/agent-name` | (aliases for `/name`)   | —                                    |
| `/model [name]`             | `handleModelCommand()`  | Show/set model (supports shorthands) |
| `/models`                   | `handleModelsCommand()` | List available models                |

Model shorthands resolved in `src/claude/utils.ts`:

Simple names (resolve to most recent):

- `opus` → `claude-opus-4-5-20251101`
- `sonnet` → `claude-sonnet-4-5-20250929`
- `haiku` → `claude-3-5-haiku-20241022`

Versioned shorthands:

- `opus-4.5`, `opus4.5`, `opus-4-5`, `opus45` → `claude-opus-4-5-20251101`
- `sonnet-4.5`, `sonnet4.5`, `sonnet-4-5`, `sonnet45` → `claude-sonnet-4-5-20250929`
- `opus-4`, `opus4` → `claude-opus-4-20250514`
- `sonnet-4`, `sonnet4` → `claude-sonnet-4-20250514`
- `sonnet-3.5`, `sonnet3.5`, `sonnet-3-5`, `sonnet35` → `claude-3-5-sonnet-20241022`
- `haiku-3.5`, `haiku3.5`, `haiku-3-5`, `haiku35` → `claude-3-5-haiku-20241022`
- `opus-3`, `opus3` → `claude-3-opus-20240229`
- `haiku-3`, `haiku3` → `claude-3-haiku-20240307`

## Permission Modes

| Command                                  | Mode Set            |
| ---------------------------------------- | ------------------- |
| `/plan`, `/readonly`                     | `plan`              |
| `/default`, `/normal`                    | `default`           |
| `/acceptEdits`, `/accept-edits`          | `acceptEdits`       |
| `/bypass`, `/yolo`, `/bypasspermissions` | `bypassPermissions` |
| `/dontask`, `/dont-ask`                  | `dontAsk`           |
| `/mode`                                  | (shows current)     |

## System Prompt

| Command                | Handler                       | Effect                       |
| ---------------------- | ----------------------------- | ---------------------------- |
| `/systemprompt [text]` | `handleSystemPromptCommand()` | Show/set/clear system prompt |
| `/prompt`              | (alias for `/systemprompt`)   | —                            |
| `/systemprompt clear`  | —                             | Reset to default prompt      |
| `/promptappend [text]` | `handlePromptAppendCommand()` | Append to default prompt     |
| `/appendprompt`        | (alias for `/promptappend`)   | —                            |
| `/promptappend clear`  | —                             | Clear appended text          |

Setting prompt clears session (context changes).

## CLAUDE.md

| Command               | Handler                   | Effect                            |
| --------------------- | ------------------------- | --------------------------------- |
| `/claudemd [sources]` | `handleClaudeMdCommand()` | Set sources: user, project, local |
| `/settings`           | (alias for `/claudemd`)   | —                                 |
| `/claudemd clear`     | —                         | Disable CLAUDE.md loading         |

## Configuration

| Command                                | Handler                 | Effect                                            |
| -------------------------------------- | ----------------------- | ------------------------------------------------- |
| `/config`                              | `handleConfigCommand()` | Show runtime config                               |
| `/config show`, `/config list`         | —                       | Show runtime config                               |
| `/config path`                         | —                       | Show config file location                         |
| `/config save`                         | —                       | Save to `{directory}/.whatsapp-claude-agent.json` |
| `/config generate`, `/config template` | —                       | Generate template                                 |
| `/reload`                              | `handleReloadCommand()` | Reload & apply config from disk                   |

## Session Invalidation

Certain config changes require starting a new session. The following properties invalidate sessions when changed:

| Property             | Description               |
| -------------------- | ------------------------- |
| `directory`          | Working directory         |
| `model`              | Claude model              |
| `systemPrompt`       | Custom system prompt      |
| `systemPromptAppend` | System prompt append text |

Defined in `SESSION_INVALIDATING_KEYS` in `src/conversation/manager.ts`.

Commands that change these properties (`/cd`, `/model`, `/prompt`, `/promptappend`, `/reload`) automatically invalidate the session if one is active.

## Group Mode

When running with `--join-whatsapp-group`, the agent enters group mode:

- Agent listens ONLY to the specified group (ignores private messages)
- Agent only responds to targeted messages (see below)
- Whitelist applies to sender (participant), not group JID
- Use `--allow-all-group-participants` to allow all group members (bypasses whitelist)

### Targeting the Agent

In group mode, messages must be explicitly targeted at the agent:

| Format                     | Example                    | Description                       |
| -------------------------- | -------------------------- | --------------------------------- |
| `@AgentName <message>`     | `@Spider Man what is 2+2?` | Mention by agent name             |
| `@ai <message>`            | `@ai help me`              | Generic AI mention                |
| `@agent <message>`         | `@agent do something`      | Generic agent mention             |
| `/ask <message>`           | `/ask what time is it?`    | Slash command (targets any agent) |
| `/ask AgentName <message>` | `/ask Spider Man hello`    | Slash command with specific agent |

Notes:

- Agent name matching is case-insensitive
- Multi-word names work: `@Spider Man hello` or `@spiderman hello`
- Non-targeted messages are ignored
- All standard commands work the same once targeted

### Permission Responses in Group Mode

When Claude requests permission for a tool in group mode, responses must also be targeted:

| Response       | Effect     |
| -------------- | ---------- |
| `@name Y`      | Allow      |
| `@name N`      | Deny       |
| `@ai Y` / `N`  | Allow/Deny |
| `@agent Y`/`N` | Allow/Deny |

In private mode, simple `Y` or `N` responses work directly.

## Adding New Commands

1. Add case in `handleCommand()` switch statement
2. Create handler method if complex
3. Update `getHelpMessage()`
4. If config-related, may need session clear logic
