# whatsapp-claude-agent

Bridge WhatsApp with Claude Code - interact with your files via WhatsApp messages.

## Features

- **Claude Agent SDK integration**: Direct integration with Claude Agent SDK
- **Permission modes**: Full SDK permission modes (default, acceptEdits, bypassPermissions, plan, dontAsk)
- **WhatsApp commands**: Switch modes, clear history, check status
- **Message chunking**: Long responses are split into multiple messages
- **Session persistence**: WhatsApp authentication is saved
- **Whitelist security**: Only respond to specified phone numbers

## Installation

### Download Pre-built Binary (Recommended)

**Option 1: Download from GitHub Releases (easiest)**

Visit the [GitHub Releases page](https://github.com/dsebastien/whatsapp-claude-agent/releases) and download the appropriate binary for your platform:

| Platform              | File                                    |
| --------------------- | --------------------------------------- |
| Linux (x64)           | `whatsapp-claude-agent-linux-x64`       |
| macOS (Apple Silicon) | `whatsapp-claude-agent-darwin-arm64`    |
| macOS (Intel)         | `whatsapp-claude-agent-darwin-x64`      |
| Windows (x64)         | `whatsapp-claude-agent-windows-x64.exe` |

After downloading, make it executable (Linux/macOS):

```bash
chmod +x whatsapp-claude-agent-*
```

**Option 2: Download via command line**

```bash
# Download (example for Linux x64)
curl -L -o whatsapp-claude-agent https://github.com/dsebastien/whatsapp-claude-agent/releases/latest/download/whatsapp-claude-agent-linux-x64

# Make executable
chmod +x whatsapp-claude-agent

# Run
./whatsapp-claude-agent -w "+1234567890"
```

### Build from Source

See [DEVELOPMENT.md](DEVELOPMENT.md) for instructions on building from source.

## Usage

```bash
whatsapp-claude-agent [options]

Options:
  -d, --directory <path>         Working directory for Claude (default: cwd)
  -m, --mode <mode>              Permission mode (see below)
  -w, --whitelist <numbers>      Comma-separated phone numbers (required)
  -s, --session <path>           WhatsApp session directory
  --model <model>                Claude model to use (supports shorthands)
  --max-turns <n>                Maximum conversation turns
  --process-missed               Process messages received while offline
  --no-process-missed            Don't process messages received while offline
  --missed-threshold <mins>      Only process messages from last N minutes
  --system-prompt <prompt>       Custom system prompt (replaces default)
  --system-prompt-append <text>  Text to append to default system prompt
  --load-claude-md <sources>     Load CLAUDE.md files (user,project,local)
  --resume <sessionId>           Resume a previous Claude session
  --fork                         Fork the session when resuming (creates new branch)
  -v, --verbose                  Enable verbose logging
  -c, --config <path>            Path to config file
  -h, --help                     Show help
  --version                      Show version
```

### Examples

The examples below use `./whatsapp-claude-agent` as a placeholder. Replace with your actual binary name (e.g., `./whatsapp-claude-agent-linux-x64`, `./whatsapp-claude-agent-darwin-arm64`, etc.).

```bash
# Basic usage with your phone number
./whatsapp-claude-agent -w "+1234567890"

# Point to a specific folder
./whatsapp-claude-agent -w "+1234567890" -d ~/Documents/notes

# Enable verbose logging
./whatsapp-claude-agent -w "+1234567890" -v

# Start in read-only mode
./whatsapp-claude-agent -w "+1234567890" -m plan

# Auto-accept file edits
./whatsapp-claude-agent -w "+1234567890" -m acceptEdits

# Full access mode (dangerous!)
./whatsapp-claude-agent -w "+1234567890" -m bypassPermissions

# Custom system prompt
./whatsapp-claude-agent -w "+1234567890" --system-prompt "You are a helpful coding assistant."

# Append instructions to default prompt
./whatsapp-claude-agent -w "+1234567890" --system-prompt-append "Always explain your reasoning."

# Load CLAUDE.md files from user and project directories
./whatsapp-claude-agent -w "+1234567890" --load-claude-md user,project

# Resume a previous session
./whatsapp-claude-agent -w "+1234567890" --resume <session-id>

# Resume and fork (create a new branch from the session)
./whatsapp-claude-agent -w "+1234567890" --resume <session-id> --fork

# Use a specific model (with shorthand)
./whatsapp-claude-agent -w "+1234567890" --model opus
./whatsapp-claude-agent -w "+1234567890" --model sonnet-4
./whatsapp-claude-agent -w "+1234567890" --model haiku
```

## WhatsApp Commands

Once connected, you can send these commands via WhatsApp:

### Session & Directory Commands

| Command          | Description                               |
| ---------------- | ----------------------------------------- |
| `/help`          | Show available commands                   |
| `/status`        | Show agent status                         |
| `/clear`         | Clear conversation history                |
| `/session`       | Show current session ID                   |
| `/session <id>`  | Set session ID to resume                  |
| `/session clear` | Start a new session                       |
| `/fork`          | Fork current session (create a branch)    |
| `/cd`            | Show current working directory            |
| `/cd <path>`     | Change working directory (clears session) |

### Model Commands

| Command         | Description                 |
| --------------- | --------------------------- |
| `/model`        | Show current model          |
| `/model <name>` | Switch to a different model |
| `/models`       | List all available models   |

**Model Shorthands:** You can use shorthands instead of full model IDs:

| Shorthand                              | Resolves To                |
| -------------------------------------- | -------------------------- |
| `opus`                                 | claude-opus-4-5-20251101   |
| `sonnet`                               | claude-sonnet-4-5-20250929 |
| `haiku`                                | claude-3-5-haiku-20241022  |
| `opus-4.5`, `opus-4-5`, `opus45`       | claude-opus-4-5-20251101   |
| `sonnet-4.5`, `sonnet-4-5`, `sonnet45` | claude-sonnet-4-5-20250929 |
| `opus-4`, `opus4`                      | claude-opus-4-20250514     |
| `sonnet-4`, `sonnet4`                  | claude-sonnet-4-20250514   |
| `sonnet-3.5`, `sonnet-3-5`, `sonnet35` | claude-3-5-sonnet-20241022 |
| `haiku-3.5`, `haiku-3-5`, `haiku35`    | claude-3-5-haiku-20241022  |

Simple shorthands (`opus`, `sonnet`, `haiku`) always resolve to the most recent version of each model family.

### Permission Mode Commands

| Command        | Description                              |
| -------------- | ---------------------------------------- |
| `/mode`        | Show current permission mode             |
| `/plan`        | Switch to plan mode (read-only)          |
| `/default`     | Switch to default mode (asks permission) |
| `/acceptEdits` | Switch to acceptEdits mode               |
| `/bypass`      | Switch to bypassPermissions mode         |
| `/dontAsk`     | Switch to dontAsk mode                   |

### System Prompt Commands

Customize how Claude behaves by modifying the system prompt. See the [Claude Agent SDK documentation](https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts) for details.

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `/prompt`              | Show current system prompt           |
| `/prompt <text>`       | Set a custom system prompt           |
| `/prompt clear`        | Reset to default system prompt       |
| `/promptappend <text>` | Append text to default system prompt |
| `/promptappend clear`  | Clear appended text                  |

### CLAUDE.md Settings Commands

| Command                  | Description                      |
| ------------------------ | -------------------------------- |
| `/claudemd`              | Show current CLAUDE.md sources   |
| `/claudemd user,project` | Load specified CLAUDE.md sources |
| `/claudemd clear`        | Disable CLAUDE.md loading        |

Valid CLAUDE.md sources: `user` (global ~/.claude/CLAUDE.md), `project` (project CLAUDE.md), `local` (local settings)

## Session Management

The agent supports session persistence, allowing you to resume or fork previous conversations with Claude. Sessions maintain full conversation context, so Claude remembers everything from previous interactions.

### How Sessions Work

1. **Automatic Session Creation**: When you start a conversation, a session ID is automatically created and captured
2. **View Session ID**: Use `/session` or `/status` to see your current session ID
3. **Resume Later**: Use the session ID with `--resume` to continue where you left off
4. **Fork Sessions**: Create branches to explore different directions without losing the original conversation

### Resuming Sessions

Resume a previous session via CLI:

```bash
./whatsapp-claude-agent -w "+1234567890" --resume abc123-session-id
```

Or via WhatsApp command:

```
/session abc123-session-id
```

Then send your next message - Claude will have full context from the previous session.

### Forking Sessions

Forking creates a new conversation branch from an existing session. The original session remains unchanged, allowing you to:

- Explore different approaches from the same starting point
- Test changes without affecting the original conversation
- Create multiple parallel conversation paths

**Fork via CLI** (at startup):

```bash
./whatsapp-claude-agent -w "+1234567890" --resume abc123-session-id --fork
```

**Fork via WhatsApp** (during conversation):

```
/fork
```

After `/fork`, your next message creates a new session branch. The original session is preserved.

### Session Commands Summary

| Command          | Description                                  |
| ---------------- | -------------------------------------------- |
| `/session`       | Show current session ID                      |
| `/session <id>`  | Set session ID to resume on next message     |
| `/session clear` | Clear session and start fresh                |
| `/fork`          | Fork current session (next message branches) |

## Permission Modes

These align with the [Claude Agent SDK permission modes](https://docs.anthropic.com/en/docs/claude-code/sdk):

| Mode                | Description                                                  |
| ------------------- | ------------------------------------------------------------ |
| `default`           | Standard behavior - prompts for dangerous operations         |
| `acceptEdits`       | Auto-accept file edit operations (Write, Edit, NotebookEdit) |
| `bypassPermissions` | Bypass all permission checks (dangerous!)                    |
| `plan`              | Planning/read-only mode - no tool execution                  |
| `dontAsk`           | Don't prompt for permissions - deny if not pre-approved      |

## Configuration File

You can create a config file at `~/.whatsapp-claude-agent/config.json`:

```json
{
    "whitelist": ["+1234567890", "+0987654321"],
    "mode": "default",
    "model": "sonnet",
    "verbose": false,
    "systemPrompt": "You are a helpful coding assistant.",
    "systemPromptAppend": "Always explain your reasoning.",
    "settingSources": ["user", "project"],
    "resumeSessionId": "abc123-session-id",
    "forkSession": false
}
```

Notes:

- Use either `systemPrompt` (replaces default) OR `systemPromptAppend` (adds to default), not both
- `resumeSessionId` can be set to automatically resume a specific session on startup
- `forkSession` when `true` will fork the resumed session instead of continuing it
- `model` supports shorthands like `opus`, `sonnet`, `haiku`, or full model IDs

## Security Considerations

1. **Whitelist enforcement**: Only numbers in the whitelist can interact with the agent
2. **Session security**: WhatsApp credentials are stored locally - keep them safe
3. **Permission modes**: Default to `default` mode for safety - avoid `bypassPermissions` unless necessary
4. **Rate limiting**: Be aware of WhatsApp's rate limits (~1000-2000 msgs/day)

## Requirements

- [Bun](https://bun.sh/) runtime (v1.0+)
- Node.js 20+ (for some dependencies)
- Active WhatsApp account
- Claude API key or Claude Code installed and configured (see Authentication below)

## Authentication

The Claude Agent SDK requires authentication to access Claude models. The SDK spawns Claude Code as a subprocess, so **if Claude Code is already installed and authenticated on your machine, the SDK will automatically use those credentials** - no additional configuration needed.

### Using Existing Claude Code Authentication (Easiest)

If you've already installed and authenticated Claude Code:

```bash
# Install Claude Code globally (if not already installed)
npm install -g @anthropic-ai/claude-code

# Authenticate (one-time setup)
claude

# That's it! The Agent SDK will automatically use Claude Code's credentials
```

Claude Code stores credentials securely (in macOS Keychain on Mac, or equivalent on other platforms) and the SDK inherits this authentication when spawning Claude Code.

### Manual API Key Configuration

If you prefer to use an API key directly:

1. Get an API key from the [Anthropic Console](https://console.anthropic.com/)
2. Set the environment variable:

```bash
export ANTHROPIC_API_KEY=your-api-key
```

Or add it to your `.env` file (Bun loads it automatically):

```bash
# .env
ANTHROPIC_API_KEY=your-api-key
```

### Third-Party Providers

#### Amazon Bedrock

```bash
export CLAUDE_CODE_USE_BEDROCK=1
# Configure AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION)
```

#### Google Vertex AI

```bash
export CLAUDE_CODE_USE_VERTEX=1
# Configure Google Cloud credentials (GOOGLE_APPLICATION_CREDENTIALS)
```

#### Microsoft Foundry

```bash
export CLAUDE_CODE_USE_FOUNDRY=1
# Configure Azure credentials
```

For detailed third-party provider configuration, see the [Claude Agent SDK documentation](https://platform.claude.com/docs/en/agent-sdk/overview#authentication)

## License

MIT
