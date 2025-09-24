# SWB (Scoop With Bun) - Current Codebase Architecture

**Last Updated**: September 2025

## Project Overview

SWB is a modern TypeScript/JavaScript reimplementation of the Scoop Windows package manager, built with Bun runtime for high performance and native Windows integration.

### Key Specifications

- **Language**: TypeScript with ES2022 target
- **Runtime**: Bun ≥1.2.0 (Windows-only)
- **Module System**: ESNext with Bundler resolution
- **Build Target**: Windows x64 executable
- **License**: Apache 2.0
- **Version**: 0.1.0

## Architecture Overview

### Entry Points

- **Main CLI**: `src/cli.ts` - Simple entry point that exports process exit code
- **CLI Engine**: `src/lib/cli.ts` - Core CLI framework with command registry
- **Build Script**: `scripts/build.ts` - Bun compilation with version injection

### Core Libraries (`src/lib/`)

#### CLI Framework (`cli.ts`)

- **Functions**: `runCLI()`, `registerCommands()`, `loadCommand()`, `getVersion()`, `printHelp()`
- **Features**: Dynamic command loading, version injection (`SWB_VERSION`), command caching
- **Architecture**: Centralized command registry pattern

#### Command Registry (`commands.ts`)

- **Functions**: `getAvailableCommandNames()`, `getCommandDefinition()`, `hasCommand()`
- **Pattern**: Static command registry with metadata
- **Separation**: Clean separation from CLI engine

#### Manifest System (`manifests.ts`)

- **Types**: `FoundManifest`, `InfoFields` interfaces
- **Functions**: `findAllManifests()`, `findBucketManifest()`, `findInstalledManifest()`
- **Features**: Multi-bucket search, installed app detection, bucket parsing
- **Official Scoop Integration**: Full support for official Scoop manifest schema

#### App Management (`apps.ts`)

- **Types**: `InstalledApp` interface
- **Functions**: `listInstalledApps()`, `resolveAppPrefix()`, `readCurrentTarget()`
- **Key Feature**: `resolveAppPrefix(app, scope, returnCurrentPath)` - handles both current symlinks and versioned paths

#### Utilities (`which.ts`)

- **Function**: Enhanced `which()` with shim resolution to actual executable paths
- **Scoop Compatibility**: Properly resolves Windows shims like native Scoop

### Commands (`src/commands/`)

#### Available Commands

1. **`config.ts`** - Configuration management
2. **`info.ts`** - Enhanced app information with comprehensive bucket search
3. **`list.ts`** - List installed applications
4. **`prefix.ts`** - Get app installation paths (current symlink support)
5. **`which.ts`** - Find executable locations with shim resolution

#### Enhanced Info Command

- **Multi-bucket Search**: Searches all available buckets comprehensively
- **Official Manifest Support**: Full Scoop manifest field support with deepwiki integration
- **Bucket Detection**: Proper detection from `install.json`
- **Removed**: "Also available in" section (redundant with multi-bucket search)

### Utilities (`src/utils/`)

#### Core Execution (`exec.ts`)

- **Functions**: `exec$()`, `exec$Text()`, `execWithOptions()`, `execSimple()`
- **Features**: Windows-optimized command execution with proper error handling

#### Command Discovery (`commands.ts`)

- **Functions**: `commandExists()`, `whichCommand()`
- **Purpose**: System command availability checking

#### Helper Utilities (`helpers.ts`)

- **Functions**: `shellQuote()`, `escapeRegex()`, `sleep()`, `wquote()`
- **Purpose**: Common utility functions

#### Module Exports (`index.ts`)

- **Purpose**: Centralized re-export of all utility functions
- **Clean**: No longer exports unused `glob` function (removed with filesystem.ts cleanup)

#### Legacy Shell (`shell.ts`)

- **Status**: Deprecated wrapper for backward compatibility
- **Purpose**: Re-exports from modular structure

## Build System

### Compilation Process

- **Tool**: Bun native compiler
- **Target**: Windows x64 executable (`dist/swb.exe`)
- **Version Injection**: `SWB_VERSION` global constant from package.json or environment
- **Output**: Single standalone executable

### Development Workflow

```bash
bun run dev    # Development with hot reload
bun run build  # Production executable compilation
bun test       # Test execution
```

## Key Technical Features

### 1. Module Resolution

- **Import Extensions**: All imports use `.ts` extensions
- **Resolution**: Bundler-based module resolution
- **Compatibility**: Full TypeScript and Bun compatibility

### 2. Command System

- **Registry Pattern**: Static command registry with metadata
- **Dynamic Loading**: Commands loaded on-demand
- **Caching**: Command modules cached for performance

### 3. Scoop Compatibility

- **Manifest Schema**: Full support for official Scoop manifest fields
- **Path Resolution**: Proper handling of current vs versioned paths
- **Shim Resolution**: Windows shim resolution like native Scoop
- **Bucket System**: Multi-bucket search and detection

### 4. Version Management

- **Build-time Injection**: Version injected during compilation
- **Global Constant**: `SWB_VERSION` available throughout codebase
- **Flexible**: Supports environment override

## Dependencies

### Runtime Dependencies

- **`commander`** ^14.0.1 - CLI argument parsing

### Development Dependencies

- **`@types/bun`** - Bun runtime types
- **`@types/node`** ^24.5.2 - Node.js types
- **`typescript`** ^5 - TypeScript compiler (peer dependency)

## Recent Major Changes

### 1. Import System Refactor

- Fixed all `.js` extension imports to `.ts`
- Resolved module resolution errors
- Improved TypeScript compatibility

### 2. Command Registry Separation

- Split command registry from CLI engine
- Created dedicated `lib/commands.ts`
- Improved maintainability and testing

### 3. Enhanced Info Command

- Integrated official Scoop documentation via deepwiki
- Implemented comprehensive multi-bucket search
- Added proper bucket detection from install.json

### 4. Path Resolution Improvements

- Enhanced `resolveAppPrefix()` with current path option
- Fixed prefix command to return current symlinks
- Added proper shim resolution in which command

### 5. Version Injection System

- Implemented build-time version injection
- Created custom build script with global constants
- Integrated with package.json version management

### 6. Code Cleanup

- Removed unused `filesystem.ts` and `glob` function
- Cleaned up all references and documentation
- Streamlined utility module exports

## Current Status

The codebase is in excellent condition with:

- ✅ All imports properly resolved
- ✅ Build system working correctly
- ✅ Full Scoop compatibility features
- ✅ Clean, maintainable architecture
- ✅ Comprehensive command system
- ✅ No unused code or dependencies
