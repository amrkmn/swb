# AGENTS.md

SWB (Scoop With Bun) is a TypeScript reimplementation of the Scoop Windows package manager, built on the Bun runtime. It provides fast, parallel package management for Windows with full Scoop compatibility.

**Tech Stack:** Bun >=1.2.0, TypeScript 5.9.3 (strict), `mri` for arg parsing, `zod` for validation, Windows x64 standalone executable.

## Commands

```bash
# Development
bun run dev                         # Run CLI in dev mode
bun run dev search foo              # Test a specific command

# Testing
bun test                            # Run all tests
bun test tests/commands/search.test.ts  # Run single test file
bun test --watch                    # Watch mode
bun test --filter "test name"       # Run tests matching name

# Type checking
bun run typecheck                   # Run tsc --noEmit (type check only)

# Building & Release
bun run build                       # Build executable (dist/swb.exe, AVX2)
bun run build --baseline            # Build with baseline CPU compatibility
bun run build --arm64               # Build for Windows ARM64
bun run release patch               # Bump version, build, tag, push, create release
bun run release patch --dry-run     # Preview release steps
bun run changelog <from> <to>       # Generate changelog between versions

# Formatting
bun run format                      # Format all files with Prettier
bun run lint                        # Check formatting only (no changes)
bun run format:src                  # Format only src/ and scripts/
```

## Project Structure

```
src/
  cli.ts              # Entry point: run(), createContext(), command registration
  core/
    Command.ts        # Abstract Command<Args, Flags> base class
    Context.ts        # DI container interface, Logger interface, Service base class
    GroupCommand.ts   # Base for commands with subcommands
  commands/           # CLI command implementations (one dir per command)
  services/           # Business logic layer (all extend Service)
  utils/              # Shared utilities (colors, git, logger, paths, loader, workers)
  workers/            # Web Workers for parallel processing
tests/
  test-utils.ts       # createMockContext(), createMockLogger()
  commands/           # *.test.ts files mirroring src/commands/ structure
scripts/
  build.ts            # Bun.build() → dist/swb.exe
  release.ts          # Version bump, tag, push, GitHub release
  changelog.ts        # Changelog generation
```

## Services

Available via `ctx.services` in every command:

| Service     | Responsibility                                                          |
| ----------- | ----------------------------------------------------------------------- |
| `workers`   | `WorkerService` — Web Worker orchestration (search, status, bucket ops) |
| `apps`      | `AppsService` — List/read installed apps (30-second TTL cache)          |
| `buckets`   | `BucketService` — List/add/remove/status buckets                        |
| `manifests` | `ManifestService` — Find and parse app manifests                        |
| `shims`     | `ShimService` — Resolve executables via shims/PATH                      |
| `config`    | `ConfigService` — Read/write Scoop config                               |
| `cleanup`   | `CleanupService` — Remove old versions and caches                       |

## Command Implementation

Commands extend `Command<ArgsSchema, FlagsSchema>` with Zod validation. The `run()` method returns an exit code.

```typescript
import { z } from "zod";

import { Command } from "src/core/Command.ts";
import type { Context } from "src/core/Context.ts";

const SearchArgs = z.object({
  query: z.string().min(1, "Search query cannot be empty"),
});

const SearchFlags = z.object({
  global: z.boolean().default(false).describe("Search in global scope"),
  verbose: z.boolean().default(false).describe("Show detailed output"),
  bucket: z.string().optional().describe("Filter by bucket name"),
});

export class SearchCommand extends Command<typeof SearchArgs, typeof SearchFlags> {
  name = "search";
  description = "Search for apps in buckets";
  argsSchema = SearchArgs;
  flagsSchema = SearchFlags;
  flagAliases = { g: "global", v: "verbose" };
  examples = ["search git", "search -b main python"];

  async run(ctx: Context, args: z.infer<typeof SearchArgs>, flags: z.infer<typeof SearchFlags>) {
    const { logger, services } = ctx;
    try {
      // implementation
      return 0;
    } catch (err) {
      logger.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
  }
}
```

The `help()` method auto-generates flag documentation from Zod `.describe()` strings and `flagAliases`. Use `.describe()` on every flag.

### GroupCommand (subcommand groups)

For commands with subcommands (e.g. `bucket add`, `bucket list`), extend `GroupCommand` and register subcommand instances in the constructor. Routing is handled automatically via `getSubcommand(name)`.

```typescript
import { GroupCommand } from "src/core/GroupCommand.ts";
import { BucketAddCommand } from "src/commands/bucket/add.ts";
import { BucketListCommand } from "src/commands/bucket/list.ts";

export class BucketCommand extends GroupCommand {
  name = "bucket";
  description = "Manage buckets";

  constructor() {
    super();
    this.subcommands = [new BucketAddCommand(), new BucketListCommand()];
  }
}
```

Each subcommand is a normal `Command` subclass. Place them in `src/commands/<group>/<subcommand>.ts`.

## Display Utilities

Prefer the shared utilities over ad-hoc formatting:

- **Colors** (`src/utils/colors.ts`): `red`, `green`, `yellow`, `blue`, `cyan`, `magenta`, `gray`, `dim`, `bold`, `underline` — ANSI wrappers, safe to compose.
- **Table layout** (`src/utils/helpers.ts`): `formatLineColumns(lines: string[][], options)` — terminal-width-aware column formatter with column weights. Use for aligned multi-column output.
- **Progress** (`src/utils/loader.ts`): `Loading` (spinner) and `ProgressBar` — use for long-running operations.

Separate display/formatting logic into a `views.ts` file next to `index.ts` when a command has non-trivial output.

## Testing

Tests use Bun's built-in test runner. Call `mock.module()` **before** any imports to avoid side effects:

```typescript
import { describe, test, expect, mock, beforeEach } from "bun:test";

// Must be before importing the module under test
mock.module("src/utils/logger.ts", () => ({
  log: mock(() => {}),
  error: mock(() => {}),
}));

import { SearchCommand } from "src/commands/search/index.ts";
import { createMockContext } from "../test-utils.ts";

describe("search command", () => {
  let command: SearchCommand;
  let context: ReturnType<typeof createMockContext>;

  beforeEach(() => {
    command = new SearchCommand();
    context = createMockContext();
  });

  test("should return 0 on success", async () => {
    context.services.workers.search = mock(() => Promise.resolve([]));
    context.services.apps.listInstalled = mock(() => []);

    const result = await command.run(context, { query: "git" }, { global: false, verbose: false });

    expect(result).toBe(0);
    expect(context.services.workers.search).toHaveBeenCalled();
  });
});
```

Mock service methods by **direct assignment** on `context.services.*`. Do not mock internal implementation details — only mock at the service method boundary.

## Code Style

### Imports

```typescript
// External packages first
import mri from "mri";
import { z } from "zod";

// Blank line, then internal imports — src/ prefix, .ts extension required
import { Command } from "src/core/Command.ts";
import type { Context } from "src/core/Context.ts";
import { getWorkerUrl } from "src/utils/workers.ts";
```

### Formatting (Prettier)

| Setting         | Value                                |
| --------------- | ------------------------------------ |
| `printWidth`    | 100                                  |
| `tabWidth`      | 4 (2 for `.md`)                      |
| `semi`          | true                                 |
| `singleQuote`   | false (double quotes everywhere)     |
| `trailingComma` | `"es5"`                              |
| `arrowParens`   | `"avoid"` → `x => x`, not `(x) => x` |
| `endOfLine`     | `"lf"`                               |

No ESLint or Biome — Prettier is the only formatter.

### Naming

| Element               | Style             | Example                         |
| --------------------- | ----------------- | ------------------------------- |
| Files                 | kebab-case        | `my-service.ts`                 |
| Classes / Interfaces  | PascalCase        | `class SearchCommand`           |
| Functions / Variables | camelCase         | `getWorkerUrl()`, `bucketCount` |
| Constants             | UPPER_SNAKE_CASE  | `DEFAULT_TIMEOUT`               |
| Private members       | underscore prefix | `_privateMethod()`              |

### TypeScript

- Strict mode; target ES2022; `moduleResolution: Bundler`
- `allowImportingTsExtensions: true` — always use `.ts` extension in internal imports
- Explicit types for all parameters and return values
- Prefer `interface` over `type` aliases for object shapes
- Avoid `any`; use `unknown` for unknown types
- Use `z.infer<typeof Schema>` for Zod-inferred types
- Use `import type` for type-only imports
- Always check `err instanceof Error` before accessing `.message`

## Workers

Workers enable parallel processing. To add a new worker:

1. Create `src/workers/<name>.ts` (or `src/workers/<category>/<name>.ts`)
2. Add the file to the `entrypoints` array in `scripts/build.ts`
3. Access it via `getWorkerUrl("<name>")` or `getWorkerUrl("<category>/<name>")`
4. The worker is automatically embedded in the compiled executable

In dev mode, `getWorkerUrl()` returns a `.ts` file URL. In compiled mode it returns an embedded path (`B:/~BUN/root/workers/`). Always use `getWorkerUrl()` — never hardcode paths.

Worker messages use discriminated union types with a `type` field (`"result"`, `"error"`, `"progress"`). Always type both the outbound `postMessage` payload and the inbound `onmessage` handler.

## Commit Messages

Follow Conventional Commits: `<type>(<scope>): <subject>`

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `style`, `test`, `perf`, `ci`

**Common scopes:** `search`, `status`, `cleanup`, `build`, `release`, `ci`, `ui`, `help`

```bash
feat(search): add --installed flag to filter results
fix(status): handle missing install.json gracefully
chore(release): bump version to 0.7.8
refactor(ui): make formatLineColumns generic
```

- Present tense, imperative mood (`add feature` not `added feature`)
- Subject line under 72 characters, no trailing period
- Body (if needed): explain _what_ and _why_, wrap at 72 characters

## Gotchas

- **Paths:** Use `path.win32.join()` — never hardcode backslashes
- **Symlinks:** Use `realpathSync()` for junction resolution
- **Workers:** Always use `getWorkerUrl()` for worker initialization
- **Error messages:** Check `err instanceof Error` before `.message`
- **Service mocks:** Mock entire service methods (direct assignment), not internal properties
- **Test module mocks:** Call `mock.module()` before importing the module under test (hoisting)
- **Build constants:** `SWB_VERSION` and `SWB_WORKER_PATH` are injected at compile time by `scripts/build.ts`
- **Flags help:** Add `.describe("...")` to every Zod flag field; `help()` reads these automatically
- **Scoop paths:** User scope uses `%USERPROFILE%\scoop`; global scope uses `C:\ProgramData\scoop`; resolved via `src/utils/paths.ts`
- **Install info:** Per-app metadata (bucket, hold status) lives in `<apps>/<name>/current/install.json`
