# Development Guide

This document explains how to set up the development environment, build from source, and contribute to the project.

## Prerequisites

- [Bun](https://bun.sh/) v1.0 or later
- [Node.js](https://nodejs.org/) 20+ (for some dependencies)
- [Claude Code](https://www.npmjs.com/package/@anthropic-ai/claude-code) installed and authenticated

## Getting Started

### Clone the Repository

```bash
git clone https://github.com/dsebastien/whatsapp-claude-agent.git
cd whatsapp-claude-agent
```

### Install Dependencies

```bash
bun install
```

### Run in Development Mode

```bash
# Start TypeScript watch (recommended - run in separate terminal)
bun run tsc:watch

# Run the agent
bun run dev -- -w "+1234567890"
```

## Available Scripts

| Script                 | Description                        |
| ---------------------- | ---------------------------------- |
| `bun run dev`          | Run in development mode            |
| `bun run tsc`          | Run TypeScript type checking       |
| `bun run tsc:watch`    | Run TypeScript in watch mode       |
| `bun run lint`         | Run ESLint                         |
| `bun run lint:fix`     | Run ESLint with auto-fix           |
| `bun run format`       | Format code with Prettier          |
| `bun run format:check` | Check formatting                   |
| `bun run commit`       | Interactive commit with Commitizen |

## Building

### Build JavaScript Bundle

```bash
bun run build
# Output: dist/cli.js
```

### Build Platform-Specific Executables

```bash
# Build for current platform
bun run build:exe

# Build for specific platforms
bun run build:exe:linux      # Linux x64
bun run build:exe:macos      # macOS Apple Silicon (arm64)
bun run build:exe:macos-x64  # macOS Intel (x64)
bun run build:exe:windows    # Windows x64

# Build all platforms
bun run build:all
```

Executables are output to the `dist/` directory.

## Project Structure

```
whatsapp-claude-agent/
├── src/
│   ├── index.ts              # Main entry point
│   ├── types.ts              # TypeScript types and Zod schemas
│   ├── cli/
│   │   ├── commands.ts       # CLI argument parsing
│   │   └── config.ts         # Configuration loading
│   ├── claude/
│   │   ├── backend.ts        # Abstract Claude backend
│   │   ├── sdk-backend.ts    # Claude Agent SDK implementation
│   │   └── permissions.ts    # Permission management
│   ├── conversation/
│   │   ├── manager.ts        # Conversation handling
│   │   ├── history.ts        # Message history
│   │   └── queue.ts          # Message queue
│   ├── whatsapp/
│   │   ├── client.ts         # WhatsApp client wrapper
│   │   ├── auth.ts           # WhatsApp authentication
│   │   └── messages.ts       # Message parsing
│   └── utils/
│       ├── logger.ts         # Pino logger setup
│       └── phone.ts          # Phone number utilities
├── dist/                     # Build output
├── CLAUDE.md                 # Claude Code instructions
├── AGENTS.md                 # Agent-specific instructions
└── package.json
```

## Code Style

This project uses:

- **TypeScript** for type safety
- **ESLint** for linting
- **Prettier** for code formatting
- **Conventional Commits** for commit messages

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/). Use the interactive commit tool:

```bash
bun run commit
```

Or follow the format manually:

```
type(scope): description

feat: add new feature
fix: fix a bug
docs: documentation changes
refactor: code refactoring
test: add or update tests
chore: maintenance tasks
```

## Testing

```bash
bun test
```

## Releasing

Releases are handled automatically by GitHub Actions when a tag is pushed:

```bash
# Create a new version tag
git tag -a v0.1.0 -m "Release v0.1.0"
git push origin v0.1.0
```

The CI will:

1. Build executables for all platforms
2. Create a GitHub release with the binaries attached

## Troubleshooting

### TypeScript Errors

Always run the TypeScript watcher during development:

```bash
bun run tsc:watch
```

### Claude Code Not Found

Ensure Claude Code is installed globally:

```bash
npm install -g @anthropic-ai/claude-code
```

### WhatsApp Authentication Issues

Delete the session directory and re-authenticate:

```bash
rm -rf ~/.whatsapp-claude-agent/session
bun run dev -- -w "+1234567890"
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run linting and type checking (`bun run lint && bun run tsc`)
5. Commit using conventional commits (`bun run commit`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request
