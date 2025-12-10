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
  -d, --directory <path>     Working directory for Claude (default: cwd)
  -m, --mode <mode>          Permission mode (see below)
  -w, --whitelist <numbers>  Comma-separated phone numbers (required)
  -s, --session <path>       WhatsApp session directory
  --model <model>            Claude model to use
  --max-turns <n>            Maximum conversation turns
  --process-missed           Process messages received while offline
  --no-process-missed        Don't process messages received while offline
  --missed-threshold <mins>  Only process messages from last N minutes
  -v, --verbose              Enable verbose logging
  -c, --config <path>        Path to config file
  -h, --help                 Show help
  --version                  Show version
```

### Examples

```bash
# Basic usage with your phone number
bun run dev -- -w +1234567890

# Point to a specific folder
bun run dev -- -w +1234567890 -d ~/Documents/notes

# Enable verbose logging
bun run dev -- -w +1234567890 -v

# Start in read-only mode
bun run dev -- -w +1234567890 -m plan

# Auto-accept file edits
bun run dev -- -w +1234567890 -m acceptEdits

# Full access mode (dangerous!)
bun run dev -- -w +1234567890 -m bypassPermissions
```

## WhatsApp Commands

Once connected, you can send these commands via WhatsApp:

| Command        | Description                              |
| -------------- | ---------------------------------------- |
| `/help`        | Show available commands                  |
| `/status`      | Show agent status                        |
| `/clear`       | Clear conversation history               |
| `/mode`        | Show current permission mode             |
| `/plan`        | Switch to plan mode (read-only)          |
| `/default`     | Switch to default mode (asks permission) |
| `/acceptEdits` | Switch to acceptEdits mode               |
| `/bypass`      | Switch to bypassPermissions mode         |
| `/dontAsk`     | Switch to dontAsk mode                   |

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
    "model": "claude-sonnet-4-20250514",
    "verbose": false
}
```

## Security Considerations

1. **Whitelist enforcement**: Only numbers in the whitelist can interact with the agent
2. **Session security**: WhatsApp credentials are stored locally - keep them safe
3. **Permission modes**: Default to `default` mode for safety - avoid `bypassPermissions` unless necessary
4. **Rate limiting**: Be aware of WhatsApp's rate limits (~1000-2000 msgs/day)

## Requirements

- [Bun](https://bun.sh/) runtime (v1.0+)
- Node.js 20+ (for some dependencies)
- Active WhatsApp account
- Claude API key (see Authentication below)

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
