# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SWB (Scoop With Bun) is a TypeScript/JavaScript reimplementation of the Scoop Windows package manager, built with Bun runtime. It provides fast package management for Windows with native shell integration.

## Development Commands

```bash
# Development
bun run dev          # Run CLI in development mode
bun test            # Run tests
bun run build       # Build for production (outputs to dist/cli.js)

# Code formatting
bun run format      # Format all files with Prettier
bun run format:check # Check formatting without changes
bun run format:src  # Format only src/ and scripts/ directories
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

- `logger.ts` - Centralized logging with colored output using chalk
- `colors.ts` - Color utility functions
- `exec.ts` - Command execution helpers
- `helpers.ts` - General utility functions

**Search Optimization** (`src/lib/cache.ts`, `src/lib/commands/search-optimized.ts`)

- Persistent search cache with 5-minute TTL to solve cold start performance
- Precomputed search indexes for package names, versions, descriptions, and binaries
- Background cache warming during CLI startup
- Cache stored in `~/.swb/cache/search-cache.json` (configurable via `SWB_HOME`)
- Dramatically faster search performance (~50ms vs 500ms+ originally)

### Build System

- Uses Bun's native bundler (`Bun.build`)
- Target: Bun runtime
- Minification enabled for production
- Version injection via `SWB_VERSION` environment variable
- Build script: `scripts/build.ts`

### Code Conventions

- TypeScript with strict mode enabled
- ES2022 target with ESNext modules
- Bun-specific bundler resolution
- Import paths use `src/` prefix for internal modules
- Command definitions follow consistent interface pattern
- Error handling with proper exit codes (0 = success, 1 = error)

## Performance Optimization

**Search Cache Management**

```bash
swb cache          # Update search cache (default action)
swb cache --update # Explicitly update cache
swb cache --force  # Force update even if cache is recent
swb cache --clear  # Clear search cache
```

**Environment Variables**

- `SWB_HOME` - Custom home directory (default: `~`)
  - Data directory becomes `$SWB_HOME/.swb`
  - Cache files stored in `$SWB_HOME/.swb/cache/`
  - Useful for shared environments or custom storage locations

The search cache significantly improves performance by:

- Eliminating cold start delays (2+ minutes → ~50ms)
- Precomputing searchable indexes from bucket manifests
- Using persistent storage with smart invalidation
- Background warming during CLI startup

## Scoop Compatibility

SWB follows Scoop conventions:

- App installations in `<root>\apps\<name>\current` (symlink to version folder)
- Separate user and global scopes
- Compatible with existing Scoop directory structures
- Maintains Scoop's CLI interface patterns
