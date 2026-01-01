# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SWB (Scoop With Bun) is a TypeScript/JavaScript reimplementation of the Scoop Windows package manager, built with Bun runtime. It provides fast package management for Windows with native shell integration.

## Development Commands

```bash
# Development
bun run dev          # Run CLI in development mode
bun test             # Run tests
bun run build        # Build standalone executable (outputs to dist/swb.exe)

# Code formatting
bun run format       # Format all files with Prettier
bun run format:check # Check formatting without changes
bun run format:src   # Format only src/ and scripts/ directories

# Releasing
bun run release patch    # Bump patch version (0.0.x), build, tag, push, publish
bun run release minor    # Bump minor version (0.x.0)
bun run release major    # Bump major version (x.0.0)
bun run release patch --dry-run  # Preview without making changes
```

## Architecture Overview

### Core Structure

- **Entry Point**: `src/cli.ts` - Main CLI entry that delegates to `src/lib/cli.ts`
- **CLI System**: `src/lib/cli.ts` - Handles argument parsing, command registration, and execution
- **Command Registry**: `src/lib/commands.ts` - Centralizes all available commands
- **Parser**: `src/lib/parser.ts` - Command line argument parsing and validation

### Key Components

**Apps Management** (`src/lib/apps.ts`)

- Scans installed apps from Scoop directories
- Resolves symlinks for current app versions
- Caches app listings for performance (30-second TTL)
- Handles both user (`%USERPROFILE%\scoop`) and global (`C:\ProgramData\scoop`) scopes

**Path Resolution** (`src/lib/paths.ts`)

- Windows-specific Scoop path handling
- Supports user and global installation scopes
- Provides utilities for apps, shims, buckets, and cache directories

**Commands** (`src/commands/`)
Available commands include:

- `cache` - Manage search cache for faster performance
- `list` - List installed apps with optional filtering
- `which` - Locate executable paths
- `status` - Show installation status
- `config` - Configuration management
- `info` - App information display
- `prefix` - Show app installation paths
- `search` - Search for packages (with optimized caching)

**Utilities** (`src/utils/`)

- `logger.ts` - Centralized logging with colored output using ANSI escape codes
- `colors.ts` - Color utility functions with native ANSI escape code implementation
- `exec.ts` - Command execution helpers
- `helpers.ts` - General utility functions
- `loader.ts` - Loading spinner and ProgressBar utilities for CLI feedback

**Parallel Workers** (`src/lib/workers/`)

- Centralized Web Workers for parallel processing
- `src/lib/workers/index.ts` - Worker path resolution with `getWorkerUrl()` function
- `src/lib/workers/search.ts` - Search worker for parallel bucket scanning
- `src/lib/workers/status.ts` - Status worker for parallel status checks
- Workers are embedded in compiled executable using Bun's virtual filesystem
- Each worker operates independently on separate data batches
- Used by `src/lib/search/parallel.ts` and `src/lib/status/parallel.ts`

### Build System

- Uses Bun's native bundler (`Bun.build`) with compile mode only
- Produces standalone executable (`dist/swb.exe`) with embedded workers
- Workers embedded using Bun's virtual filesystem (`B:/~BUN/root/lib/workers`)
- Minification enabled for production
- Version injection via `SWB_VERSION` environment variable
- Build script: `scripts/build.ts`
- Release script: `scripts/release.ts` - handles version bump, build, git tag, and npm publish
- Worker entrypoints: `src/lib/workers/search.ts`, `src/lib/workers/status.ts`
- Compile-time constant `SWB_WORKER_PATH` defined during build

**Adding New Workers:**

1. Create worker file in `src/lib/workers/<name>.ts`
2. Add worker entrypoint to `scripts/build.ts` entrypoints array
3. Use `getWorkerUrl("<name>")` from `src/lib/workers/index.ts` to resolve worker path
4. Worker automatically embedded in compiled executable

### Code Conventions

- TypeScript with strict mode enabled
- ES2022 target with ESNext modules
- Bun-specific bundler resolution
- Import paths use `src/` prefix for internal modules
- Command definitions follow consistent interface pattern
- Error handling with proper exit codes (0 = success, 1 = error)

## Dependencies

### Runtime

- `mri` ^1.2.0 - Command-line argument parsing

### Development

- `@types/bun` latest - Bun runtime type definitions
- `@types/node` ^24.7.0 - Node.js type compatibility
- `prettier` ^3.6.2 - Code formatting

### Peer

- `typescript` ^5.9.3 - TypeScript compiler support

## Testing

The project uses Bun's built-in test runner (`bun test`). Currently, no test files exist in the repository.

## Performance Optimization

**Environment Variables**

- `SWB_HOME` - Custom home directory (default: `~`)
  - Data directory becomes `$SWB_HOME/.swb`
  - Used for any local cache files if needed
  - Useful for shared environments or custom storage locations

**Parallel Search System**

The search system uses multi-worker parallel processing for fast performance:

- Multiple Web Workers scan buckets in parallel
- Each worker processes one bucket directory independently
- Progress tracking with real-time bucket status updates
- Typical search completes in under 1 second across all buckets

## Scoop Compatibility

SWB follows Scoop conventions:

- App installations in `<root>\apps\<name>\current` (symlink to version folder)
- Separate user and global scopes
- Compatible with existing Scoop directory structures
- Maintains Scoop's CLI interface patterns

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
