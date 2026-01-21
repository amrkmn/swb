# AGENTS.md

SWB is a TypeScript reimplementation of Scoop package manager built with Bun runtime.

**Tech Stack:** Bun >=1.2.0, TypeScript 5.9.3 (strict mode), Windows x64 standalone executable

## Commands

```bash
# Development
bun run dev              # Run CLI in dev mode
bun run dev search foo   # Test specific command

# Testing
bun test                 # Run all tests
bun test <file>          # Run single test file
bun test --watch         # Watch mode

# Build & Release
bun run build            # Build executable (dist/swb.exe)
bun run release patch    # Bump version, build, tag, push, create release
bun run release patch --dry-run  # Preview release steps

# Formatting
bun run format       # Format all files
bun run format:check # Check formatting only
```

## Code Style

### Formatting (Prettier)

Print width: 100, Tab width: 4 spaces, Semicolons: required, Quotes: double, Trailing commas: ES5, LF line endings, Bracket spacing enabled. Avoid arrow parens: `x => x`.

### Imports

```typescript
import mri from "mri";
import { error, log } from "src/utils/logger.ts";
import type { CommandDefinition } from "src/lib/parser.ts";
```

External imports first, blank line, then internal imports with `src/` prefix and `.ts` extension. Use named imports and `type` keyword for type-only imports.

### Naming

| Element    | Style             | Example             |
| ---------- | ----------------- | ------------------- |
| Files      | kebab-case        | `my-module.ts`      |
| Classes    | PascalCase        | `class Parser`      |
| Functions  | camelCase         | `getWorkerUrl()`    |
| Variables  | camelCase         | `bucketCount`       |
| Interfaces | PascalCase        | `interface Command` |
| Constants  | UPPER_SNAKE_CASE  | `DEFAULT_TIMEOUT`   |
| Private    | underscore prefix | `_privateMethod()`  |

### TypeScript

- Explicit types for parameters and return values
- Prefer interfaces over type aliases for objects
- Avoid `any`; use `unknown` for unknown types
- Export types alongside implementations

### Error Handling

```typescript
handler: async (args: ParsedArgs): Promise<number> => {
  try {
    return 0; // Success
  } catch (err) {
    error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    return 1; // Error
  }
};
```

Commands return `Promise<number>` (0=success, 1=error). Always wrap in try/catch, use `error()` from logger.

## Structure

```
src/
  cli.ts              # Entry point
  commands/           # Command definitions (one per file)
  lib/
    commands.ts       # Command registry
    parser.ts         # Argument parsing (mri)
    paths.ts          # Windows path utilities
    apps.ts           # App/manifest scanning + caching
    workers/          # Web Workers
  utils/
    logger.ts         # Logging (log, error, warn, info, success)
    loader.ts         # ProgressBar, Loading spinner
```

### Adding Commands

1. Create `src/commands/<name>.ts` with `definition` export
2. Register in `src/lib/commands.ts`
3. Create test `tests/commands/<name>.test.ts`

### Adding Workers

Create `src/lib/workers/<name>.ts`, add to entrypoints in `scripts/build.ts`, use `getWorkerUrl("<name>")`.

## Testing

Use Bun's test runner. Mock modules before importing:

```typescript
import { describe, test, expect, mock } from "bun:test";
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

## Commit Messages

Follow Conventional Commits: `<type>(<scope>): <subject>`

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `style`, `test`, `perf`, `ci`

Examples: `fix(search): improve progress feedback`, `chore(release): bump version`

Guidelines: Present tense, imperative mood, <72 chars, no trailing period.

## Gotchas

- **Paths:** Use `path.win32.join()` - don't hardcode backslashes
- **Symlinks:** Use `realpathSync()` for junctions
- **Workers:** Always use `getWorkerUrl()`
- **Error messages:** Check `err instanceof Error` before `.message`
