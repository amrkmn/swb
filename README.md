# Scoop-with-Bun (SWB)

> A fast JavaScript implementation of Scoop package manager using Bun runtime

[![Bun](https://img.shields.io/badge/Bun-≥1.2.0-black?logo=bun)](https://bun.com)
[![Windows](https://img.shields.io/badge/Platform-Windows-blue?logo=windows)](https://www.microsoft.com/windows)

## What is SWB?

SWB is a modern reimplementation of the [Scoop](https://scoop.sh/) Windows package manager, built with [Bun](https://bun.com) and TypeScript. It provides fast package management for Windows with native shell integration.

## Requirements

- **Windows** (this tool is Windows-only)
- **Bun ≥1.2.0** - [Install Bun](https://bun.com/docs/installation)

## Quick Start

```bash
# Clone and install
git clone https://github.com/amrkmn/swb
cd swb
bun install

# Development
bun run dev

# Build
bun run build
```

## Commands

```bash
swb info <package>    # Get package information
swb list             # List installed packages
swb which <package>  # Find package location
swb config           # Show configuration
swb prefix [path]    # Set installation prefix
```

## Project Structure

```
src/
├── cli.ts           # Main entry point
├── commands/        # CLI commands (info, list, which, etc.)
├── lib/            # Core functionality (apps, manifests, paths)
└── utils/          # Shell utilities (modular design)
    ├── exec.ts      # Core command execution
    ├── filesystem.ts # File system operations
    ├── commands.ts  # Command discovery
    ├── helpers.ts   # General utilities
    ├── index.ts     # Main exports
    └── shell.ts     # Backward compatibility
```

## Shell Utilities

The `src/utils/` directory provides modular Windows-optimized shell functions:

```typescript
// Import from main index (recommended)
import { exec$, commandExists, whichCommand, glob } from './src/utils';

// Or import specific modules
import { exec$ } from './src/utils/exec';
import { glob } from './src/utils/filesystem';
import { commandExists } from './src/utils/commands';
import { shellQuote } from './src/utils/helpers';

// Execute commands
const result = await exec$`dir C:\\`;

// Check if command exists
const hasGit = await commandExists('git');

// Get command path
const gitPath = await whichCommand('git');

// Glob-like file matching
const tsFiles = await glob('*.ts');
const allJsFiles = await glob('**/*.js'); // recursive
const srcFiles = await glob('*.ts', { cwd: 'src' });
```

### Module Organization

- **`exec.ts`** - Core command execution with [`exec$`](src/utils/exec.ts), [`exec$Text`](src/utils/exec.ts), and [`execWithOptions$`](src/utils/exec.ts)
- **`filesystem.ts`** - File system operations with [`glob`](src/utils/filesystem.ts) for pattern matching
- **`commands.ts`** - Command utilities with [`commandExists`](src/utils/commands.ts) and [`whichCommand`](src/utils/commands.ts)
- **`helpers.ts`** - General utilities like [`shellQuote`](src/utils/helpers.ts), [`escapeRegex`](src/utils/helpers.ts), and [`sleep`](src/utils/helpers.ts)
- **`shell.ts`** - Backward compatibility wrapper (imports from index.ts)

## Development

```bash
bun run dev    # Run in development
bun test       # Run tests
bun run build  # Build for production
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `bun test` and `bun run build`
5. Submit a pull request

## License

MIT

---

**Built with [Bun](https://bun.com) for Windows**
