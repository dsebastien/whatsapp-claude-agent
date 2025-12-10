# whatsapp-claude-agent

Bridge WhatsApp with Claude Code - interact with your files via WhatsApp messages.

## Features

- **Claude Agent SDK integration**: Direct integration with Claude Agent SDK
- **Permission modes**: Read-only, normal (ask before writes), or full access
- **WhatsApp commands**: Switch modes, clear history, check status
- **Message chunking**: Long responses are split into multiple messages
- **Session persistence**: WhatsApp authentication is saved
- **Whitelist security**: Only respond to specified phone numbers

## Installation

```bash
# Clone the repo
git clone https://github.com/yourusername/whatsapp-claude-agent.git
cd whatsapp-claude-agent

# Install dependencies
bun install

# Run in development mode
bun run dev -- -w YOUR_PHONE_NUMBER
```

## Usage

```bash
whatsapp-claude-agent [options]

Options:
  -d, --directory <path>     Working directory for Claude (default: cwd)
  -m, --mode <mode>          "plan", "normal", or "dangerously-skip-permissions"
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

# Full access mode (dangerous!)
bun run dev -- -w +1234567890 -m dangerously-skip-permissions
```

## WhatsApp Commands

Once connected, you can send these commands via WhatsApp:

| Command     | Description                  |
| ----------- | ---------------------------- |
| `/help`     | Show available commands      |
| `/status`   | Show agent status            |
| `/clear`    | Clear conversation history   |
| `/mode`     | Show current permission mode |
| `/readonly` | Switch to read-only mode     |
| `/normal`   | Switch to normal mode        |
| `/yolo`     | Switch to full access mode   |

## Permission Modes

- **plan**: Claude can only read files, no writes allowed
- **normal**: Claude asks permission before writing/editing files
- **dangerously-skip-permissions**: Claude has full access (use with caution!)

## Configuration File

You can create a config file at `~/.whatsapp-claude-agent/config.json`:

```json
{
    "whitelist": ["+1234567890", "+0987654321"],
    "mode": "normal",
    "model": "claude-sonnet-4-20250514",
    "verbose": false
}
```

## Development

```bash
# Run in dev mode
bun run dev

# Type checking
bun run tsc

# Lint
bun run lint

# Format
bun run format

# Commit (interactive)
bun run commit
```

## Building

```bash
# Build single executable
bun run build

# The output is in dist/cli.js
```

## Security Considerations

1. **Whitelist enforcement**: Only numbers in the whitelist can interact with the agent
2. **Session security**: WhatsApp credentials are stored locally - keep them safe
3. **Permission modes**: Default to "normal" mode for safety
4. **Rate limiting**: Be aware of WhatsApp's rate limits (~1000-2000 msgs/day)

## Requirements

- [Bun](https://bun.sh/) runtime (v1.0+)
- Node.js 20+ (for some dependencies)
- Active WhatsApp account
- Anthropic API key

## License

MIT
