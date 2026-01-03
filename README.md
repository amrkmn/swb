# Scoop-with-Bun (SWB)

> A fast TypeScript/JavaScript reimplementation of Scoop package manager using Bun runtime

[![Bun](https://img.shields.io/badge/Bun-≥1.2.0-black?logo=bun)](https://bun.com)
[![Windows](https://img.shields.io/badge/Platform-Windows-blue?logo=windows)](https://www.microsoft.com/windows)
[![TypeScript](https://img.shields.io/badge/TypeScript-ES2022-blue?logo=typescript)](https://www.typescriptlang.org/)

## What is SWB?

SWB (Scoop With Bun) is a modern, high-performance reimplementation of the [Scoop](https://scoop.sh/) Windows package manager, built with [Bun](https://bun.com) and TypeScript. It provides lightning-fast package management for Windows with native shell integration and advanced search optimization.

## Key Features

- **Lightning Fast Search** - Parallel processing with sub-second response times
- **Smart Package Discovery** - Multi-bucket search with concurrent scanning
- **Native Windows Integration** - Built specifically for Windows with proper shim resolution
- **Full Scoop Compatibility** - Works with existing Scoop installations and manifests
- **Rich CLI Experience** - Colored output, detailed logging, and intuitive commands
- **Parallel Workers** - Multi-worker architecture for fast bucket scanning

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

# Build for production
bun run build
```

## Available Commands

### Package Management

```bash
swb search <query>     # Search for packages with optimized performance
swb info <package>     # Get detailed package information
swb list [filter]      # List installed packages
swb which <command>    # Find executable locations with shim resolution
```

### System Management

```bash
swb status            # Show installation status
swb config            # Configuration management
swb prefix <package>  # Show package installation paths
swb cleanup           # Clean up Scoop installation artifacts
```

## Performance Optimization

SWB features parallel search processing for fast performance:

- **Parallel Processing**: Multi-worker architecture scans buckets concurrently
- **Fast Execution**: Typical searches complete in under 1 second across all buckets
- **Real-time Progress**: Live bucket status updates during search
- **Efficient Scanning**: Each worker processes bucket directories independently

## Project Structure

```
src/
├── cli.ts              # Main CLI entry point
├── commands/           # Command implementations
│   ├── cleanup.ts      # Clean up artifacts
│   ├── config.ts       # Configuration
│   ├── info.ts         # Package information
│   ├── list.ts         # List packages
│   ├── prefix.ts       # Package paths
│   ├── search.ts       # Package search
│   ├── status.ts       # System status
│   └── which.ts        # Executable location
├── lib/                # Core library functions
│   ├── cli.ts          # CLI engine and command registry
│   ├── commands.ts     # Command registry
│   ├── apps.ts         # App management
│   ├── manifests.ts    # Manifest parsing
│   ├── parser.ts       # Argument parsing
│   ├── paths.ts        # Path utilities
│   ├── which.ts        # Enhanced executable resolution
│   ├── search/         # Search system with parallel processing
│   ├── status/         # Status system with parallel processing
│   └── workers/        # Web Workers for parallel processing
├── utils/              # Utility functions
│   ├── colors.ts       # Color utilities
│   ├── exec.ts         # Command execution
│   ├── helpers.ts      # General helpers
│   ├── loader.ts       # Loading spinners and progress bars
│   └── logger.ts       # Logging system
└── scripts/
    ├── build.ts        # Custom build with version injection
    └── release.ts      # Release automation
```

## Development

```bash
# Development commands
bun run dev          # Run CLI in development mode
bun test            # Run tests
bun run build       # Build for production (outputs to dist/cli.js)

# Code formatting
bun run format      # Format all files with Prettier
bun run format:check # Check formatting without changes
bun run format:src  # Format only src/ and scripts/ directories
```

## Configuration

### Environment Variables

- `SWB_HOME` - Custom home directory (default: `~`)
  - Data directory becomes `$SWB_HOME/.swb`
  - Used for any local cache files if needed

## Architecture

### Core Components

- **CLI System**: Centralized command registry with dynamic loading
- **Parallel Workers**: Web Workers for concurrent bucket scanning and status checks
- **App Management**: Scoop directory scanning with symlink resolution
- **Path Resolution**: Windows-specific path handling for user/global scopes
- **Command System**: Modular command architecture with metadata

### Scoop Compatibility

- Compatible with existing Scoop directory structures
- Supports both user (`%USERPROFILE%\scoop`) and global (`C:\ProgramData\scoop`) scopes
- Proper handling of Scoop manifests and installation metadata
- Windows shim resolution like native Scoop

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the existing patterns
4. Run `bun run format` to format code
5. Run `bun test` and `bun run build` to verify
6. Submit a pull request

## License

Apache 2.0

---

Built with [Bun](https://bun.com) for Windows - Optimized for Performance - Scoop Compatible
