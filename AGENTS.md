# AGENTS.md

This file provides comprehensive guidance for agentic coding assistants working on SWB (Scoop With Bun).

## Project Overview

SWB is a TypeScript reimplementation of the Scoop Windows package manager, built with Bun runtime. It provides fast package management for Windows with native shell integration and parallel processing capabilities.

**Key Technologies:**

-   **Runtime**: Bun (>= 1.2.0)
-   **Language**: TypeScript (5.9.3) with strict mode
-   **Target**: Windows x64 (standalone executable)
-   **Module System**: ESNext with Bundler resolution

## Essential Commands

```bash
# Development
bun run dev              # Run CLI in development mode
bun run dev search foo   # Test a specific command
bun test                 # Run all tests
bun test <file>          # Run a single test file
bun test --watch         # Run tests in watch mode

# Build & Release
bun run build                    # Build standalone executable (dist/swb.exe)
bun run release patch            # Bump patch, build, tag, push, create GitHub release
bun run release minor            # Bump minor version
bun run release major            # Bump major version
bun run release patch --dry-run  # Preview release steps without changes

# Code Formatting
bun run format       # Format all files with Prettier
bun run format:check # Check formatting without changes
bun run format:src   # Format only src/ and scripts/
```

## Code Style Guidelines

### TypeScript Configuration

-   **Target**: ES2022 with ES2022 lib
-   **Module**: ESNext with Bundler resolution
-   **Strict mode**: Enabled (all strict checks on)
-   **No emit**: TypeScript is for type checking only; Bun handles compilation
-   **Base URL**: "." (current directory)
-   **Import Extensions**: `.ts` extensions allowed in imports (`allowImportingTsExtensions: true`)
-   **Types**: Only `@types/bun` included

### Formatting (Prettier)

-   **Print width**: 100 characters
-   **Tab width**: 4 spaces (no tabs - `useTabs: false`)
-   **Semicolons**: Required
-   **Quotes**: Double quotes
-   **Trailing commas**: ES5 compatible
-   **Arrow function parens**: Avoid when possible (`x => x` not `(x) => x`)
-   **Line endings**: CRLF (Windows-style)
-   **Bracket spacing**: Enabled
-   **Bracket same line**: Disabled
-   **Quote props**: As needed
-   **Markdown files**: Use 2-space indentation (override)

### Import Organization

```typescript
// 1. External imports first
import mri from "mri";

// 2. Blank line

// 3. Internal imports with src/ prefix
import { error, log } from "src/utils/logger.ts";
import type { CommandDefinition } from "src/lib/parser.ts";
import { listInstalledApps } from "src/lib/apps.ts";
```

**Rules:**

-   Always use `src/` prefix for internal modules
-   Group external and internal imports with blank line between
-   Use `.ts` extension in imports
-   Prefer named imports over default imports
-   Use `type` keyword for type-only imports

### Naming Conventions

| Element         | Style             | Example                       |
| --------------- | ----------------- | ----------------------------- |
| Files           | kebab-case        | `my-module.ts`                |
| Classes         | PascalCase        | `class ArgumentParser`        |
| Functions       | camelCase         | `function getWorkerUrl()`     |
| Variables       | camelCase         | `const bucketCount`           |
| Interfaces      | PascalCase        | `interface CommandDefinition` |
| Type aliases    | PascalCase        | `type CommandHandler`         |
| Constants       | UPPER_SNAKE_CASE  | `const DEFAULT_TIMEOUT`       |
| Private members | underscore prefix | `_privateMethod()`            |

### TypeScript Type Guidelines

-   Use explicit types for function parameters and return values
-   Prefer interfaces over type aliases for object types
-   Use `any` sparingly; prefer `unknown` for truly unknown types
-   Use `Record<K, V>` for map-like objects
-   Use `Array<T>` syntax consistently (not `T[]`)
-   Export types alongside implementations

### Error Handling Pattern

```typescript
handler: async (args: ParsedArgs): Promise<number> => {
    try {
        // Command logic here
        return 0; // Success
    } catch (err) {
        error(`Operation failed: ${err instanceof Error ? err.message : String(err)}`);
        return 1; // Error
    }
};
```

**Requirements:**

-   Commands return `Promise<number>` where 0 = success, 1 = error
-   Always wrap command handlers in try/catch blocks
-   Use `error()` from `src/utils/logger.ts` for user-facing errors
-   Check `err instanceof Error` before accessing `.message`
-   Never log secrets or keys

## Code Structure

### File Organization

```
src/
  cli.ts              # Entry point (delegates to lib/cli.ts)
  commands/           # Command definitions (one per file)
    cleanup.ts
    config.ts
    info.ts
    list.ts
    prefix.ts
    search.ts
    status.ts
    which.ts
  lib/
    cli.ts            # Main CLI logic
    commands.ts       # Command registry
    parser.ts         # Argument parsing with mri
    paths.ts          # Windows path utilities
    apps.ts           # App/manifest scanning with caching
    commands/         # Command implementation details
      list.ts         # List command helpers
    search/           # Search implementation
      parallel.ts     # Parallel search logic
    status/           # Status implementation
      parallel.ts     # Parallel status checks
    workers/          # Web Worker implementations
      index.ts        # getWorkerUrl() helper
      search.ts       # Search worker
      status.ts       # Status worker
  utils/
    colors.ts         # ANSI color functions (native implementation)
    logger.ts         # Logging (log, error, warn, info, etc.)
    helpers.ts        # General utilities
    exec.ts           # Command execution
    loader.ts         # ProgressBar and Loading spinner

scripts/
  build.ts            # Build script using Bun.build
  release.ts          # Release automation script

tests/
  commands/           # Command tests (one per command file)
    cleanup.test.ts
    config.test.ts
    info.test.ts
    list.test.ts
    prefix.test.ts
    search.test.ts
    status.test.ts
    which.test.ts
```

### Command Pattern

Commands follow this structure in `src/commands/<name>.ts`:

```typescript
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { error, log } from "src/utils/logger.ts";

export const definition: CommandDefinition = {
    name: "command-name",
    description: "Brief description",
    arguments: [{ name: "arg", description: "...", required: false }],
    options: [{ flags: "-o, --option", description: "..." }],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            // Command implementation
            return 0;
        } catch (err) {
            error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            return 1;
        }
    },
};
```

**After creating a command:**

1. Create file in `src/commands/<name>.ts`
2. Export `definition` object following the pattern above
3. Register in `src/lib/commands.ts`:
    - Import the definition
    - Add to `commandRegistry` object
4. Create test file in `tests/commands/<name>.test.ts`

### Command Registry (`src/lib/commands.ts`)

Central registry that imports all commands and exports:

-   `commandRegistry`: Record mapping command names to definitions
-   `getAvailableCommandNames()`: Returns array of command names
-   `getCommandDefinition(name)`: Gets specific command
-   `hasCommand(name)`: Checks if command exists

### Argument Parsing

Uses `mri` library for CLI argument parsing. The `ArgumentParser` class handles:

-   Global flags: `-h/--help`, `-V/--version`, `-g/--global`, `-v/--verbose`
-   Command-specific arguments and options
-   Validation and error messages
-   Help text generation

### Logging

Use the Logger from `src/utils/logger.ts`:

```typescript
import { log, error, warn, info, success, verbose, header, newline } from "src/utils/logger.ts";

log("Regular message"); // Plain text
info("Informational (blue)"); // Blue color
success("Success (green)"); // Green color
warn("Warning (yellow)"); // Yellow color, stderr
error("Error (red)"); // Red color, stderr
verbose("Dim text for details"); // Dim/gray
header("Bold Cyan Header"); // Bold cyan
newline(); // Empty line
debug("Debug message"); // Only shows if DEBUG env var set
```

**Logger Implementation Details:**

-   Uses `process.stdout.write()` and `process.stderr.write()` directly
-   No `console.log` usage
-   ANSI color codes from `src/utils/colors.ts`
-   Errors and warnings go to stderr
-   Debug messages only appear when `DEBUG` environment variable is set

### Color Utilities (`src/utils/colors.ts`)

Native ANSI escape code implementation:

```typescript
import { red, green, yellow, blue, cyan, magenta, gray, white } from "src/utils/colors.ts";
import { bold, dim, underline } from "src/utils/colors.ts";
import { error, success, warning, info, highlight } from "src/utils/colors.ts";
```

**Available colors:**

-   Basic: `red`, `green`, `yellow`, `blue`, `cyan`, `magenta`, `gray`, `white`
-   Styled: `bold`, `dim`, `underline`
-   Semantic: `error` (red), `success` (green), `warning` (yellow), `info` (blue), `highlight` (cyan)

### Progress Indicators (`src/utils/loader.ts`)

**Loading Spinner:**

```typescript
import { Loading } from "src/utils/loader.ts";

const loader = new Loading("Checking for updates", 100);
loader.start();
// ... do work ...
loader.succeed("Updates found"); // or loader.fail("Failed")
```

**Progress Bar:**

```typescript
import { ProgressBar } from "src/utils/loader.ts";

const bar = new ProgressBar(total, "Processing");
bar.start();
bar.setProgress(current, "Current step description");
bar.complete("Done!");
```

## Build & Bundle

### Build System Details

-   Uses Bun's native bundler (`Bun.build`) with `compile: true`
-   Produces standalone Windows executable (`dist/swb.exe`)
-   Workers embedded in executable via Bun's virtual filesystem
-   Version injected via `SWB_VERSION` environment variable
-   Compile-time constants defined via `define` option
-   Minification enabled for production builds

### Build Script (`scripts/build.ts`)

Key details:

-   Entry points: `src/cli.ts`, worker files
-   Target: `bun`
-   Output directory: `dist/`
-   Output file: `swb.exe`
-   Minification: Enabled
-   Defines:
    -   `SWB_VERSION`: Version string (from `SWB_VERSION` env var or package.json)
    -   `SWB_WORKER_PATH`: Worker path (`B:/~BUN/root/lib/workers` for compiled executable)

### Release Script (`scripts/release.ts`)

Automated release workflow:

1. Validates version type (major/minor/patch)
2. Updates `package.json` version
3. Builds project with new version
4. Commits version bump
5. Creates git tag (`v<version>`)
6. Pushes to remote (triggers CI)

**Release workflow:**

-   GitHub Actions workflow (`.github/workflows/release.yml`)
-   Triggered on tag push (`v*`)
-   Runs on `windows-latest`
-   Steps: checkout, setup Bun, install deps, build, create release archive, publish GitHub release

### Adding New Workers

1. Create worker file: `src/lib/workers/<name>.ts`
2. Add to entrypoints in `scripts/build.ts`:
    ```typescript
    entrypoints: ["src/cli.ts", "src/lib/workers/search.ts", "src/lib/workers/<name>.ts"];
    ```
3. Use `getWorkerUrl("<name>")` from `src/lib/workers/index.ts` to resolve path:
    ```typescript
    import { getWorkerUrl } from "src/lib/workers/index.ts";
    const worker = new Worker(getWorkerUrl("name"));
    ```
4. Worker automatically embedded in compiled executable

**Worker Path Resolution:**

-   Development: Uses `.ts` file via `import.meta.url`
-   Production: Uses compiled `.js` file from Bun's virtual filesystem (`B:/~BUN/root/lib/workers`)
-   The `SWB_WORKER_PATH` constant is defined at build time

## Windows-Specific Notes

### Path Conventions

-   Windows paths use backslashes (`\`)
-   Always use `path.win32` utilities for path operations
-   User home: `process.env.USERPROFILE` (fallback to `process.env.HOME`)
-   Scoop user root: `%USERPROFILE%\scoop`
-   Scoop global root: `C:\ProgramData\scoop`

### Scoop Directory Structure

```
<root>/
  apps/
    <name>/
      current/          # Junction/symlink to version folder
      <version>/        # Actual version installation
        install.json    # Contains bucket info
  buckets/              # Repository clones
  cache/                # Downloaded installers
  shims/                # Executable shims
```

### Environment Variables

-   `SWB_HOME`: Custom home directory (default: `~`)
    -   Data directory becomes `$SWB_HOME/.swb`
    -   Used for any local cache files if needed
    -   Useful for shared environments or custom storage locations
-   `USERPROFILE`: Windows user home directory
-   `DEBUG`: Enable debug logging

### Installation Scopes

Two scopes supported:

-   **User scope**: `%USERPROFILE%\scoop` (default)
-   **Global scope**: `C:\ProgramData\scoop` (requires admin)

Use `resolveScoopPaths(scope)` to get paths for a specific scope.

## Architecture Details

### Apps Management (`src/lib/apps.ts`)

**Key Features:**

-   Scans installed apps from Scoop directories
-   Resolves symlinks for current app versions using `realpathSync()`
-   Caches app listings for performance (30-second TTL)
-   Handles both user and global scopes
-   Reads `install.json` to extract bucket information

**Caching Strategy:**

-   Cache TTL: 30 seconds (`CACHE_TTL_MS`)
-   Invalidates automatically after TTL expires
-   Cache shared across all queries
-   Filters applied after cache lookup

**InstalledApp Interface:**

```typescript
interface InstalledApp {
    name: string;
    scope: InstallScope; // "user" | "global"
    appDir: string; // <root>\apps\<name>
    currentPath: string | null; // resolved path of "current" symlink
    version: string | null; // basename of current target
    bucket?: string; // from install.json
}
```

### Path Resolution (`src/lib/paths.ts`)

**ScoopPaths Interface:**

```typescript
interface ScoopPaths {
    scope: InstallScope;
    root: string; // e.g., C:\Users\Me\scoop
    apps: string; // <root>\apps
    shims: string; // <root>\shims
    buckets: string; // <root>\buckets
    cache: string; // <root>\cache
}
```

**Key Functions:**

-   `resolveScoopPaths(scope)`: Get paths for specific scope
-   `scopeExists(scope)`: Check if scope directory exists
-   `bothScopes()`: Get paths for both user and global scopes
-   `getUserScoopRoot()`: Get user Scoop root
-   `getGlobalScoopRoot()`: Get global Scoop root

### Parallel Workers (`src/lib/workers/`)

**Architecture:**

-   Centralized Web Workers for parallel processing
-   Each worker processes one data batch independently
-   Workers communicate via message passing
-   Used by search and status commands

**Worker Files:**

-   `src/lib/workers/index.ts`: Path resolution helper (`getWorkerUrl()`)
-   `src/lib/workers/search.ts`: Parallel bucket scanning
-   `src/lib/workers/status.ts`: Parallel status checks

**Usage Pattern:**

```typescript
import { getWorkerUrl } from "src/lib/workers/index.ts";

const worker = new Worker(getWorkerUrl("search"));
worker.postMessage({ type: "search", data: bucketPath });
worker.onmessage = event => {
    const results = event.data;
    // Process results
};
```

## Testing

### Test Framework

-   Uses Bun's built-in test runner (`bun:test`)
-   Test files: `tests/commands/*.test.ts`
-   Run with `bun test` or `bun test <file>`
-   Watch mode: `bun test --watch`

### Test Structure

```typescript
import { describe, test, expect, mock } from "bun:test";
import { definition } from "src/commands/list.ts";
import type { ParsedArgs } from "src/lib/parser.ts";

// Mock logger to suppress output
mock.module("src/utils/logger.ts", () => ({
    log: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    success: mock(() => {}),
    verbose: mock(() => {}),
}));

describe("list command", () => {
    describe("command definition", () => {
        test("should have correct name", () => {
            expect(definition.name).toBe("list");
        });

        test("should have description", () => {
            expect(definition.description).toBeDefined();
            expect(definition.description.length).toBeGreaterThan(0);
        });

        test("should have handler function", () => {
            expect(definition.handler).toBeDefined();
            expect(typeof definition.handler).toBe("function");
        });
    });

    describe("handler", () => {
        test("should handle empty app list", async () => {
            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => []),
            }));

            const args: ParsedArgs = {
                args: [],
                flags: {},
                global: { help: false, version: false, verbose: false, global: false },
            };

            const exitCode = await definition.handler(args);
            expect(exitCode).toBe(0);
        });
    });
});
```

### Test Patterns

**Mocking Modules:**

-   Use `mock.module()` to replace module exports
-   Mock logger to suppress console output during tests
-   Mock `src/lib/apps.ts` to control app data

**Testing Commands:**

1. Test command definition structure
2. Test handler with various inputs
3. Test error handling
4. Test flag/option parsing
5. Test output formats (JSON, plain text)

**Assertions:**

-   Use `expect()` for assertions
-   Check return values (0 = success, 1 = error)
-   Verify command definition properties
-   Test edge cases (empty inputs, invalid data)

## Performance Optimization

### Parallel Processing

**Search System:**

-   Multiple Web Workers scan buckets in parallel
-   Each worker processes one bucket directory independently
-   Progress tracking with real-time bucket status updates
-   Typical search completes in under 1 second across all buckets

**Status Checks:**

-   Parallel checking of app status across buckets
-   Workers process independent data batches
-   Results aggregated after all workers complete

### Caching Strategy

**App Listings:**

-   30-second TTL cache in `src/lib/apps.ts`
-   Reduces filesystem operations
-   Shared across all list/info commands
-   Automatically invalidates after TTL

**Search Results:**

-   Search command has caching support (implementation may vary)
-   Faster subsequent searches

## Scoop Compatibility

SWB maintains compatibility with Scoop conventions:

-   App installations in `<root>\apps\<name>\current` (symlink to version folder)
-   Separate user and global scopes
-   Compatible with existing Scoop directory structures
-   Maintains Scoop's CLI interface patterns
-   Reads Scoop's `install.json` manifests
-   Uses same bucket structure (Git repositories)

**Key Differences:**

-   Implemented in TypeScript with Bun runtime (Scoop uses PowerShell)
-   Parallel processing for faster operations
-   Built-in caching for performance
-   Standalone executable distribution

## Dependencies

### Runtime Dependencies

-   `mri` ^1.2.0 - Minimal command-line argument parsing

### Development Dependencies

-   `@types/bun` latest - Bun runtime type definitions
-   `@types/node` ^24.10.4 - Node.js type compatibility
-   `prettier` ^3.7.4 - Code formatting

### Peer Dependencies

-   `typescript` ^5.9.3 - TypeScript compiler support
-   `bun` >=1.2.0 - Bun runtime (specified in engines)

## Git Conventions

### Commit Messages

-   Format: `type(scope): message`
-   Present tense, imperative mood ("Add feature" not "Added feature")
-   First letter lowercase after colon
-   No period at end of subject line

**Types:**

-   `feat`: New feature
-   `fix`: Bug fix
-   `refactor`: Code refactoring (no functional changes)
-   `perf`: Performance improvement
-   `docs`: Documentation changes
-   `chore`: Build/tooling changes
-   `test`: Test additions/changes
-   `style`: Code style changes (formatting, semicolons)

**Scopes:**

-   `search`: Search command/functionality
-   `list`: List command
-   `status`: Status command
-   `build`: Build system
-   `release`: Release automation
-   `workers`: Web Workers
-   `cli`: CLI system/parser
-   `paths`: Path utilities
-   `apps`: App management

**Examples:**

-   `feat(search): add parallel bucket scanning`
-   `fix(list): handle apps with missing version`
-   `refactor(workers): extract path resolution helper`
-   `perf(apps): add 30-second cache for app listings`
-   `docs(readme): update installation instructions`
-   `chore(build): update Bun version requirement`

### Branch/Tag Conventions

-   Main branch: `main` (or `master`)
-   Version tags: `v<major>.<minor>.<patch>` (e.g., `v0.4.0`)
-   No force pushes to main/master
-   One logical change per commit

## Common Patterns and Gotchas

### Pattern: Command Implementation

1. Create command file in `src/commands/`
2. Export `definition` object
3. Implement handler with try/catch
4. Return 0 for success, 1 for error
5. Register in `src/lib/commands.ts`
6. Create test file in `tests/commands/`

### Pattern: Using Colors

```typescript
import { error, success, warning, info } from "src/utils/colors.ts";
import { log } from "src/utils/logger.ts";

log(success("Operation completed")); // Green text
log(error("Operation failed")); // Red text
log(warning("Be careful")); // Yellow text
log(info("FYI")); // Blue text
```

### Pattern: Progress Indication

```typescript
import { ProgressBar } from "src/utils/loader.ts";

const bar = new ProgressBar(buckets.length, "Searching buckets");
bar.start();

for (let i = 0; i < buckets.length; i++) {
    // Process bucket
    bar.setProgress(i + 1, `Scanning ${buckets[i]}`);
}

bar.complete("Search complete");
```

### Gotcha: Path Separators

Always use `path.join()` or `path.win32.join()` for path construction. Don't hardcode backslashes:

```typescript
// Good
const appPath = path.join(root, "apps", name);

// Bad
const appPath = root + "\\apps\\" + name;
```

### Gotcha: Symlink Resolution

Windows junctions/symlinks require special handling:

```typescript
import { realpathSync, lstatSync } from "node:fs";

// Resolve symlink to actual path
const currentPath = path.join(appDir, "current");
const resolvedPath = realpathSync(currentPath); // Gets actual target
const version = path.basename(resolvedPath);
```

### Gotcha: Worker Path Resolution

Workers need different paths in development vs. production:

```typescript
import { getWorkerUrl } from "src/lib/workers/index.ts";

// Always use getWorkerUrl() - it handles both contexts
const worker = new Worker(getWorkerUrl("search"));

// Don't hardcode paths
const worker = new Worker("./workers/search.ts"); // Wrong!
```

### Gotcha: Module Mocking in Tests

Mock modules before importing the tested module:

```typescript
// Good: Mock first
mock.module("src/utils/logger.ts", () => ({
    log: mock(() => {}),
}));
import { definition } from "src/commands/list.ts";

// Bad: Import first (mocking won't work)
import { definition } from "src/commands/list.ts";
mock.module("src/utils/logger.ts", () => ({
    log: mock(() => {}),
}));
```

### Gotcha: Error Message Formatting

Always check if error is an Error instance:

```typescript
// Good
catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
}

// Bad
catch (err) {
    error(`Failed: ${err.message}`); // TypeScript error if err is unknown
}
```

## Quick Reference

### File Structure Quick Reference

```
src/
├── cli.ts                  # Entry point
├── commands/               # Command definitions
├── lib/
│   ├── cli.ts             # Main CLI logic
│   ├── commands.ts        # Command registry
│   ├── parser.ts          # Argument parser
│   ├── paths.ts           # Path utilities
│   ├── apps.ts            # App management
│   ├── commands/          # Command helpers
│   ├── search/            # Search logic
│   ├── status/            # Status logic
│   └── workers/           # Web Workers
└── utils/
    ├── colors.ts          # ANSI colors
    ├── logger.ts          # Logging
    ├── helpers.ts         # Utilities
    ├── exec.ts            # Command execution
    └── loader.ts          # Progress indicators

scripts/
├── build.ts               # Build script
└── release.ts             # Release automation

tests/
└── commands/              # Command tests
```

### Common Imports Quick Reference

```typescript
// Logging
import { log, error, warn, info, success, verbose } from "src/utils/logger.ts";

// Colors
import { red, green, yellow, blue, bold, dim } from "src/utils/colors.ts";

// Command types
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";

// Path utilities
import { resolveScoopPaths, bothScopes } from "src/lib/paths.ts";
import type { InstallScope, ScoopPaths } from "src/lib/paths.ts";

// App management
import { listInstalledApps, readCurrentTarget } from "src/lib/apps.ts";
import type { InstalledApp } from "src/lib/apps.ts";

// Progress indicators
import { Loading, ProgressBar } from "src/utils/loader.ts";

// Worker utilities
import { getWorkerUrl } from "src/lib/workers/index.ts";

// Node.js APIs
import { existsSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
```

### Command Template Quick Reference

```typescript
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { error, log } from "src/utils/logger.ts";

export const definition: CommandDefinition = {
    name: "command-name",
    description: "Command description",
    arguments: [
        {
            name: "arg",
            description: "Argument description",
            required: false,
        },
    ],
    options: [
        {
            flags: "-o, --option",
            description: "Option description",
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            // Implementation here
            return 0;
        } catch (err) {
            error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            return 1;
        }
    },
};
```
