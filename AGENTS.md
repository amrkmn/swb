# AGENTS.md

SWB is a TypeScript reimplementation of Scoop package manager built with Bun runtime.

**Tech Stack:** Bun >=1.2.0, TypeScript 5.9.3 (strict mode), Windows x64 standalone executable

## Commands

```bash
# Development
bun run dev                    # Run CLI in dev mode
bun run dev search foo         # Test specific command

# Testing
bun test                       # Run all tests
bun test tests/commands/search.test.ts   # Run single test file
bun test --watch               # Watch mode
bun test --filter "test name"  # Run tests matching name

# Building & Release
bun run build                  # Build executable (dist/swb.exe)
bun run build --baseline       # Build with baseline Windows version
bun run release patch          # Bump version, build, tag, push, create release
bun run release patch --dry-run # Preview release steps
bun run changelog              # Generate changelog

# Formatting
bun run format                 # Format all files
bun run format:check           # Check formatting only
bun run format:src             # Format only src/ and scripts/
```

## Code Style

### Formatting (Prettier)

- `printWidth`: 100, `tabWidth`: 4 (2 for .md)
- `semi`: true, `singleQuote`: false
- `trailingComma`: "es5", `arrowParens`: "avoid"
- `endOfLine`: "lf"

### Imports

```typescript
import { z } from "zod";
import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
```

External imports first, blank line, then internal imports with `src/` prefix and `.ts` extension.

### Naming

| Element    | Style             | Example               |
| ---------- | ----------------- | --------------------- |
| Files      | kebab-case        | `my-module.ts`        |
| Classes    | PascalCase        | `class SearchCommand` |
| Functions  | camelCase         | `getWorkerUrl()`      |
| Variables  | camelCase         | `bucketCount`         |
| Interfaces | PascalCase        | `interface Command`   |
| Constants  | UPPER_SNAKE_CASE  | `DEFAULT_TIMEOUT`     |
| Private    | underscore prefix | `_privateMethod()`    |

### TypeScript

- Explicit types for parameters and return values
- Prefer interfaces over type aliases for objects
- Avoid `any`; use `unknown` for unknown types
- Use `z.infer<typeof Schema>` for inferred types
- Export types alongside implementations

### Error Handling

```typescript
async run(ctx: Context, args: z.infer<Args>, flags: z.infer<Flags>): Promise<number> {
  try {
    return 0; // Success
  } catch (err) {
    ctx.logger.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    return 1; // Error
  }
}
```

## Command Implementation

Commands extend `Command<ArgsSchema, FlagsSchema>` with zod validation:

```typescript
const SearchArgs = z.object({
  query: z.string().min(1, "Search query cannot be empty"),
});

const SearchFlags = z.object({
  global: z.boolean().default(false),
  verbose: z.boolean().default(false),
});

export class SearchCommand extends Command<typeof SearchArgs, typeof SearchFlags> {
  name = "search";
  description = "Search for apps in buckets";
  argsSchema = SearchArgs;
  flagsSchema = SearchFlags;
  flagAliases = { g: "global", v: "verbose" };

  async run(ctx: Context, args: z.infer<typeof SearchArgs>, flags: z.infer<typeof SearchFlags>) {
    const { logger, services } = ctx;
    // Implementation
    return 0;
  }
}
```

## Services

Available services via `ctx.services`:

- `services.workers` - WorkerService for background tasks
- `services.apps` - AppsService for app operations
- `services.buckets` - BucketService for bucket management
- `services.manifests` - ManifestService for manifest parsing
- `services.shims` - ShimService for shim management
- `services.config` - ConfigService for configuration
- `services.cleanup` - CleanupService for cleanup operations

## Testing

```typescript
import { describe, test, expect, mock, beforeEach } from "bun:test";
import { createMockContext } from "../test-utils";

describe("command", () => {
  let context = createMockContext();

  test("should work", async () => {
    context.services.workers.search = mock(() => Promise.resolve([]));
    // Test implementation
  });
});
```

## Project Structure

```
src/
  cli.ts              # Entry point
  core/               # Core abstractions
    Command.ts        # Base command class
    Context.ts        # Execution context
    GroupCommand.ts   # Commands with subcommands
  commands/           # Command implementations
  services/           # Service layer
  utils/              # Utilities
  workers/            # Web Workers
```

## Commit Messages

Follow Conventional Commits: `<type>(<scope>): <subject>`

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `style`, `test`, `perf`, `ci`

Example: `fix(search): improve progress feedback`

Guidelines: Present tense, imperative mood, <72 chars, no trailing period.

## Gotchas

- **Paths:** Use `path.win32.join()` - don't hardcode backslashes
- **Symlinks:** Use `realpathSync()` for junctions
- **Workers:** Always use `getWorkerUrl()` for worker initialization
- **Error messages:** Check `err instanceof Error` before `.message`
- **Service mocks:** Mock entire service methods in tests, not internal properties
