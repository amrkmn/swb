# Scoop-with-Bun (SWB) Project Overview

## Project Description

Scoop With Bun (swb) is a JavaScript implementation of Scoop (Windows package manager) using Bun's runtime and shell capabilities. This is a Windows-specific CLI tool that reimplements Scoop functionality in TypeScript/JavaScript.

## Architecture

### Core Architecture Pattern

SWB uses a **services-based architecture** with dependency injection:

- **Entry Point**: `src/cli.ts` - Contains `run()` main entry and `createContext()` for DI
- **Core Layer** (`src/core/`): Abstract base classes
  - `Command.ts` - Base class for all CLI commands with Zod schema validation
  - `GroupCommand.ts` - Base for commands with subcommands
  - `Context.ts` - DI container interface + Service base class
- **Services Layer** (`src/services/`): Business logic layer
  - `AppsService`, `BucketService`, `CleanupService`, `ConfigService`, `ManifestService`, `ShimService`, `WorkerService`
- **Commands Layer** (`src/commands/`): CLI command implementations organized by feature
- **Workers** (`src/workers/`): Web Workers for parallel processing (search, status, bucket operations)
- **Utils** (`src/utils/`): Utility functions including `getWorkerUrl()` for worker path resolution

### Key Technologies

- **Runtime**: Bun (>=1.2.0)
- **Language**: TypeScript with ES2022 target, ESNext modules
- **Validation**: Zod for command args/flags schema validation
- **CLI Parsing**: mri for command-line argument parsing
- **Target Platform**: Windows only

## Project Structure

```
src/
├── cli.ts              # Main CLI entry point
├── core/               # Abstract base classes and interfaces
│   ├── Command.ts      # Base class for all commands (Zod validation)
│   ├── GroupCommand.ts # Base class for commands with subcommands
│   └── Context.ts      # DI container interface + Service base class
├── services/           # Business logic layer (all extend Service)
│   ├── AppsService.ts
│   ├── BucketService.ts
│   ├── CleanupService.ts
│   ├── ConfigService.ts
│   ├── ManifestService.ts
│   ├── ShimService.ts
│   └── WorkerService.ts # Web Worker orchestration
├── commands/           # CLI command implementations
│   ├── bucket/         # Bucket management commands
│   ├── cleanup/
│   ├── config/
│   ├── info/
│   ├── list/
│   ├── prefix/
│   ├── search/
│   ├── status/
│   ├── version/
│   └── which/
├── workers/            # Web Workers for parallel processing
│   ├── search.ts       # Parallel bucket search
│   ├── status.ts       # Parallel status checks
│   └── bucket/         # Bucket-specific workers
└── utils/              # Utility functions
    ├── colors.ts       # ANSI color codes
    ├── git.ts          # Git operations
    ├── helpers.ts      # General helpers
    ├── known-buckets.ts# Known bucket registry
    ├── loader.ts       # Progress bars and spinners
    ├── logger.ts       # Colored logging
    ├── paths.ts        # Windows path utilities
    ├── version.ts      # Version resolution
    └── workers.ts      # Worker URL resolution (getWorkerUrl)
```

## Build and Distribution

- **Binary name**: `swb`
- **Build target**: Bun compile mode
- **Output**: `dist/swb.exe`
- **Development**: `bun run src/cli.ts` or `bun run dev`
- **Build**: `bun run build` (AVX2) or `bun run build --baseline` (CPU baseline)
- **Workers**: Embedded in compiled executable via Bun's virtual filesystem (`B:/~BUN/root/workers/`)
- **Worker path resolution**: `getWorkerUrl()` in `src/utils/workers.ts` handles both dev (.ts) and compiled (embedded) modes

## Adding New Commands

1. Create command file in `src/commands/<name>/index.ts`
2. Extend `Command` class with Zod schemas for args/flags
3. Implement `run(ctx, args, flags)` method
4. Register command in `src/cli.ts`
5. Add test file in `tests/commands/<name>.test.ts`

## Adding New Workers

1. Create worker file in `src/workers/<name>.ts` or `src/workers/<category>/<name>.ts`
2. Add worker entrypoint to `scripts/build.ts` entrypoints array
3. Use `getWorkerUrl("<category>/<name>")` or `getWorkerUrl("<name>")` from services
4. Worker automatically embedded in compiled executable

## Key Features

Based on the structure, SWB implements core Scoop functionality with parallel processing:

- Package information and listing
- Configuration management
- Application path resolution
- Manifest parsing
- Bucket management (add, remove, update, list)
- Parallel search across all buckets
- Parallel status checking
- Command-line interface with multiple subcommands

## Windows-Specific Design

The project is explicitly designed for Windows environments, leveraging Windows-specific commands like `where.exe` and Windows path conventions. Uses `path.win32.join()` for all path operations.
