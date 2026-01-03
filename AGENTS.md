# AGENTS.md

This file provides essential guidance for agentic coding assistants working on SWB (Scoop With Bun).

## Project Overview

SWB is a TypeScript reimplementation of the Scoop Windows package manager, built with Bun runtime. Fast package management with parallel processing capabilities.

**Key Technologies:** Bun >=1.2.0, TypeScript 5.9.3 (strict mode), Windows x64 standalone executable

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
bun run release patch --dry-run  # Preview release steps without changes

# Code Formatting
bun run format       # Format all files with Prettier
bun run format:check # Check formatting without changes
```

## Code Style Guidelines

### Formatting (Prettier)

- Print width: 100, Tab width: 4 spaces, Semicolons: required, Quotes: double quotes
- Trailing commas: ES5, Arrow function parens: avoid (`x => x`)
- Line endings: CRLF (Windows), Bracket spacing: enabled

### Import Organization

```typescript
// 1. External imports first
import mri from "mri";

// 2. Blank line

// 3. Internal imports with src/ prefix
import { error, log } from "src/utils/logger.ts";
import type { CommandDefinition } from "src/lib/parser.ts";
```

**Rules:** Always use `src/` prefix for internal modules, use `.ts` extensions, prefer named imports, use `type` keyword for type-only imports.

### Naming Conventions

| Element         | Style             | Example                       |
| --------------- | ----------------- | ----------------------------- |
| Files           | kebab-case        | `my-module.ts`                |
| Classes         | PascalCase        | `class ArgumentParser`        |
| Functions       | camelCase         | `function getWorkerUrl()`     |
| Variables       | camelCase         | `const bucketCount`           |
| Interfaces      | PascalCase        | `interface CommandDefinition` |
| Constants       | UPPER_SNAKE_CASE  | `const DEFAULT_TIMEOUT`       |
| Private members | underscore prefix | `_privateMethod()`            |

### TypeScript Guidelines

- Use explicit types for function parameters and return values
- Prefer interfaces over type aliases for object types
- Use `any` sparingly; prefer `unknown` for truly unknown types
- Export types alongside implementations

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

**Requirements:** Commands return `Promise<number>` (0 = success, 1 = error), always wrap in try/catch, use `error()` from `src/utils/logger.ts`, check `err instanceof Error` before accessing `.message`.

## Code Structure

```
src/
  cli.ts              # Entry point
  commands/           # Command definitions (one per file)
  lib/
    commands.ts       # Command registry
    parser.ts         # Argument parsing with mri
    paths.ts          # Windows path utilities
    apps.ts           # App/manifest scanning with caching
    workers/          # Web Workers
  utils/
    colors.ts         # ANSI color functions
    logger.ts         # Logging (log, error, warn, info, success)
    helpers.ts        # General utilities
    loader.ts         # ProgressBar and Loading spinner
```

### Command Pattern

Create file `src/commands/<name>.ts`:

```typescript
export const definition: CommandDefinition = {
  name: "command-name",
  description: "Brief description",
  handler: async (args: ParsedArgs): Promise<number> => {
    try {
      // Implementation
      return 0;
    } catch (err) {
      error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
  },
};
```

**After creating:** Register in `src/lib/commands.ts`, create test in `tests/commands/<name>.test.ts`

### Build System

- Uses Bun's native bundler (`Bun.build`) with `compile: true`
- Produces standalone Windows executable (`dist/swb.exe`)
- Workers embedded via Bun's virtual filesystem
- Version injected via `SWB_VERSION` env var

**Adding Workers:** Create `src/lib/workers/<name>.ts`, add to entrypoints in `scripts/build.ts`, use `getWorkerUrl("<name>")` from `src/lib/workers/index.ts`

## Testing

Uses Bun's built-in test runner (`bun:test`). Test files: `tests/commands/*.test.ts`.

```typescript
import { describe, test, expect, mock } from "bun:test";

// Mock logger to suppress output
mock.module("src/utils/logger.ts", () => ({
  log: mock(() => {}),
  error: mock(() => {}),
}));

describe("command-name", () => {
  test("should work", async () => {
    expect(result).toBe(0);
  });
});
```

**Pattern:** Mock modules before importing tested module, check return values (0 = success, 1 = error).

## Common Gotchas

- **Path Separators:** Always use `path.join()` or `path.win32.join()` - don't hardcode backslashes
- **Symlink Resolution:** Use `realpathSync()` to resolve Windows junctions/symlinks
- **Worker Paths:** Always use `getWorkerUrl()` - it handles dev vs production paths
- **Module Mocking:** Mock modules before importing the tested module (not after)
- **Error Messages:** Always check `err instanceof Error` before accessing `.message`
