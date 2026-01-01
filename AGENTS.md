# AGENTS.md

This file provides guidance for agentic coding assistants working on SWB (Scoop With Bun).

## Project Overview

SWB is a TypeScript reimplementation of the Scoop Windows package manager, built with Bun runtime. It provides fast package management for Windows with native shell integration.

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

- **Target**: ES2022 with strict mode enabled
- **Module**: ESNext with Bundler resolution
- **No emit**: TypeScript is for type checking only; Bun handles compilation

### Formatting (Prettier)

- Print width: 100 characters
- Tab width: 4 spaces (no tabs)
- Semicolons: required
- Quotes: double quotes
- Trailing commas: ES5 compatible
- Arrow function parens: avoid when possible (`x => x` not `(x) => x`)
- Line endings: CRLF (Windows-style)

### Imports

```typescript
// External imports first
import mri from "mri";

// Internal imports with src/ prefix (blank line between groups)
import { error, log } from "src/utils/logger.ts";
import type { CommandDefinition } from "src/lib/parser.ts";
```

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

### TypeScript Types

- Use explicit types for function parameters and return values
- Prefer interfaces over type aliases for object types
- Use `any` sparingly; prefer `unknown` for truly unknown types
- Use `Record<K, V>` for map-like objects
- Use `Array<T>` syntax consistently (not `T[]`)

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

- Commands return `Promise<number>` where 0 = success, 1 = error
- Always wrap command handlers in try/catch blocks
- Use `error()` from `src/utils/logger.ts` for user-facing errors
- Never log secrets or keys

## Code Structure

### File Organization

```
src/
  cli.ts              # Entry point (delegates to lib/cli.ts)
  commands/           # Command definitions (one per file)
  lib/
    cli.ts            # Main CLI logic
    commands.ts       # Command registry
    parser.ts         # Argument parsing
    paths.ts          # Windows path utilities
    apps.ts           # App/manifest scanning
    workers/          # Web Worker implementations
      index.ts        # getWorkerUrl() helper
      search.ts       # Search worker
      status.ts       # Status worker
  utils/
    colors.ts         # ANSI color functions
    logger.ts         # Logging (log, error, warn, info, etc.)
    helpers.ts        # General utilities
    exec.ts           # Command execution
    loader.ts         # ProgressBar and spinner
```

### Command Pattern

Commands follow this structure in `src/commands/<name>.ts`:

```typescript
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { error } from "src/utils/logger.ts";

export const definition: CommandDefinition = {
  name: "command-name",
  description: "Brief description",
  arguments: [{ name: "arg", description: "...", required: false }],
  options: [{ flags: "-o, --option", description: "..." }],
  handler: async (args: ParsedArgs): Promise<number> => {
    // implementation
    return 0;
  },
};
```

After creating a command, register it in `src/lib/commands.ts`.

### Logging

Use the Logger from `src/utils/logger.ts`:

```typescript
import { log, error, warn, info, success, verbose } from "src/utils/logger.ts";

log("Regular message");
info("Informational (blue)");
success("Success (green)");
warn("Warning (yellow)");
error("Error (red)");
verbose("Dim text for details");
```

## Build & Bundle

- Uses Bun's native bundler (`Bun.build`) with `compile: true`
- Workers embedded in executable via Bun's virtual filesystem
- Version injected via `SWB_VERSION` define during build
- Production output: `dist/swb.exe` (standalone Windows executable)

### Adding New Workers

1. Create worker file: `src/lib/workers/<name>.ts`
2. Add to entrypoints in `scripts/build.ts`
3. Use `getWorkerUrl("<name>")` from `src/lib/workers/index.ts`

## Windows-Specific Notes

- Paths use backslashes; use `path.win32` utilities
- User home: `process.env.USERPROFILE`
- Scoop paths: `%USERPROFILE%\scoop` (user) or `C:\ProgramData\scoop` (global)
- Environment variable: `SWB_HOME` overrides default home directory

## Testing

- Uses Bun's built-in test runner
- Run single file: `bun test path/to/file.test.ts`
- Place tests alongside source or in `tests/` directory

## Git Conventions

- Commit messages: present tense, concise ("Add feature" not "Added feature")
- Format: `type(scope): message` (e.g., `fix(search): handle empty results`)
- Types: `feat`, `fix`, `refactor`, `perf`, `docs`, `chore`, `test`
- One logical change per commit
- No force pushes to main/master
