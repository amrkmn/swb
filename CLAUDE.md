# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SWB (Scoop With Bun) is a TypeScript/JavaScript reimplementation of the Scoop Windows package manager, built with Bun runtime. It provides fast package management for Windows with parallel search processing and full Scoop compatibility.

## Development Commands

```bash
# Development
bun run dev              # Run CLI in development mode
bun run dev search foo   # Test specific command with arguments
bun test                 # Run all tests
bun test <file>          # Run single test file
bun test --watch         # Run tests in watch mode
bun run build            # Build standalone executable (outputs to dist/swb.exe)
bun run build --baseline # Build with CPU baseline compatibility

# Code formatting
bun run format       # Format all files with Prettier
bun run format:check # Check formatting without changes
bun run format:src   # Format only src/ and scripts/ directories

# Releasing
bun run release patch    # Bump patch version (0.0.x), build, tag, push to trigger CI
bun run release minor    # Bump minor version (0.x.0)
bun run release major    # Bump major version (x.0.0)
bun run release patch --dry-run  # Preview without making changes
bun run changelog <from-version> <to-version>  # Generate changelog between versions
```

## Architecture Overview

### Core Architecture Pattern

SWB uses a **services-based architecture** with dependency injection:

```
src/
├── cli.ts              # Entry point with run() and createContext()
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

### Key Components

**Entry Point** (`src/cli.ts`)
- `run()` - Main entry point, parses CLI args with `mri`, dispatches to commands
- `createContext()` - Creates DI container with all services
- Commands are registered at module level in `src/cli.ts`

**Command System** (`src/core/Command.ts`)
- Abstract `Command<Args, Flags>` class with Zod schema validation
- `argsSchema` - Zod schema for positional arguments
- `flagsSchema` - Zod schema for command flags/options
- `run(ctx, args, flags)` - Abstract method for command implementation
- `help(ctx)` - Auto-generated help from Zod schemas
- `flagAliases` - Map short flags to long names for help display
- `examples` - Usage examples for help text

**Context Interface** (`src/core/Context.ts`)
- DI container containing: `version`, `logger`, `verbose` flag, and `services`
- All services extend abstract `Service` class (receives Context in constructor)
- Services accessed via `ctx.services.buckets`, `ctx.services.workers`, etc.

**WorkerService** (`src/services/WorkerService.ts`)
- Centralized Web Worker orchestration
- `search()` - Parallel bucket search with progress tracking
- `updateBucket()` - Parallel git updates for buckets
- `checkStatus()` - Parallel status checks across buckets
- `findAllBuckets()` - Discover all bucket locations
- Uses `getWorkerUrl()` from `src/utils/workers.ts` for path resolution

### Build System

**Bun Build Configuration:**
- Uses `Bun.build()` with compile mode (produces standalone `.exe`)
- Default target: `bun-windows-x64` (AVX2)
- Baseline target: `bun-windows-x64-baseline` (with `--baseline` flag)
- Minification enabled for production
- Workers embedded via Bun's virtual filesystem (`B:/~BUN/root/workers/`)

**Build Script** (`scripts/build.ts`):
- Entrypoints: `src/cli.ts` + all workers (`src/workers/**/*.ts`)
- Compile-time constants:
  - `SWB_VERSION` - Version string from package.json or env var
  - `SWB_WORKER_PATH` - Virtual filesystem path for workers
- Output: `dist/swb.exe`

**Worker Path Resolution** (`src/utils/workers.ts`):
- `getWorkerUrl(workerName)` - Returns worker URL
- Development mode: Returns `.ts` file URL via `import.meta.url`
- Compiled mode: Returns embedded path using `SWB_WORKER_PATH`

**Release Script** (`scripts/release.ts`):
- Bumps version in package.json
- Runs build, creates git tag, pushes to trigger GitHub Actions
- GitHub Actions builds both AVX2 and baseline variants
- Automatically creates GitHub releases with compiled binaries

**Adding New Workers:**

1. Create worker file in `src/workers/<name>.ts` or `src/workers/<category>/<name>.ts`
2. Add worker entrypoint to `scripts/build.ts` entrypoints array
3. Use `getWorkerUrl("<category>/<name>")` or `getWorkerUrl("<name>")` from services
4. Worker automatically embedded in compiled executable

### Code Conventions

**TypeScript Configuration:**
- Target: ES2022 with ESNext modules
- Bundler resolution for imports
- Strict mode enabled
- `.ts` extensions required for internal imports

**Import Pattern:**

```typescript
// External imports first
import mri from "mri";
import { z } from "zod";

// Blank line separator

// Internal imports with .ts extension
import type { Command } from "src/core/Command.ts";
import type { Context } from "src/core/Context.ts";
import { log } from "src/utils/logger.ts";
```

**Formatting (Prettier):**
- Print width: 100
- Tab width: 4 spaces
- Semicolons: required
- Quotes: double
- Trailing commas: ES5
- Avoid arrow parens: `x => x`

**Naming Conventions:**
- Files: kebab-case (`my-service.ts`)
- Classes/Interfaces: PascalCase (`class Command`, `interface Context`)
- Functions/Variables: camelCase (`getWorkerUrl()`, `bucketCount`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`)
- Private members: underscore prefix (`_privateMethod()`)

**TypeScript Guidelines:**
- Use `type` keyword for type-only imports
- Explicit types for parameters and return values
- Prefer interfaces over type aliases for objects
- Avoid `any`; use `unknown` for unknown types
- Always check `err instanceof Error` before accessing `.message`

**Windows-Specific:**
- Use `path.win32.join()` for paths - don't hardcode backslashes
- Use `realpathSync()` for resolving junctions/symlinks

## Dependencies

### Runtime
- `mri` ^1.2.0 - Command-line argument parsing
- `zod` ^4.3.6 - Schema validation for command args/flags

### Development
- `@types/bun` latest - Bun runtime type definitions
- `@types/node` ^24.10.9 - Node.js type compatibility
- `prettier` ^3.8.1 - Code formatting

### Peer
- `typescript` ^5.9.3 - TypeScript compiler support

## Testing

The project uses Bun's built-in test runner (`bun test`). Test files are in `tests/commands/` with `.test.ts` extension, mirroring the command structure in `src/commands/`.

**Testing Pattern:**
Mock modules before importing to avoid side effects:

```typescript
import { describe, test, expect, mock } from "bun:test";

// Mock logger to prevent console output during tests
mock.module("src/utils/logger.ts", () => ({
  log: mock(() => {}),
  error: mock(() => {}),
}));

describe("command", () => {
  test("does thing", async () => {
    expect(result).toBe(0);
  });
});
```

## Git Commit Message Format

Follow the Conventional Commits specification:

### Format

```
<type>(<scope>): <subject>

[optional body]
```

### Types
- `feat` - New feature or enhancement
- `fix` - Bug fix
- `chore` - Maintenance tasks (deps, release, cleanup)
- `docs` - Documentation changes
- `refactor` - Code restructuring without behavior change
- `style` - Formatting changes (whitespace, missing semicolons, etc.)
- `test` - Adding or updating tests
- `perf` - Performance improvements
- `ci` - CI/CD configuration changes

### Scopes (optional but recommended)
Common scopes: `release`, `search`, `help`, `cleanup`, `build`, `ci`, `ui`, `status`

### Examples
```bash
feat(release): add automatic changelog generation
fix(search): improve progress bar feedback during post-processing
fix(help): remove trailing spaces from help output
chore(release): bump version to 0.4.10
docs: simplify and update README
refactor(ui): make formatLineColumns generic and reusable
style(cleanup): adjust output formatting
test: add test files for all commands
```

### Guidelines
- Use present tense ("add feature" not "added feature")
- Use imperative mood ("move cursor to..." not "moves cursor to...")
- Keep subject line under 72 characters
- Capitalize first letter of subject
- No period at the end of subject line
- Separate subject from body with blank line (if body is needed)
- Wrap body at 72 characters
- Use body to explain what and why, not how

# important-instruction-reminders

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (\*.md) or README files. Only create documentation files if explicitly requested by the User.
