# AGENTS.md

This file provides guidance for agentic coding assistants working on SWB (Scoop With Bun).

## Project Overview

SWB is a TypeScript reimplementation of the Scoop Windows package manager, built with Bun runtime. It provides fast package management for Windows with native shell integration.

## Essential Commands

```bash
# Development
bun run dev          # Run CLI in development mode
bun test             # Run all tests
bun test <file>      # Run a single test file

# Build & Release
bun run build        # Build for production (outputs to dist/cli.js)
bun run release patch    # Bump patch version, build, tag, push, publish
bun run release minor    # Bump minor version
bun run release major    # Bump major version
bun run release patch --dry-run  # Preview without changes

# Code Formatting
bun run format       # Format all files with Prettier
bun run format:check # Check formatting without changes
bun run format:src   # Format only src/ and scripts/
```

## Code Style Guidelines

### TypeScript Configuration

- **Target**: ES2022 with strict mode enabled
- **Module**: ESNext with Bundler resolution
- **No emit**: TypeScript is used for type checking only; Bun handles compilation

### Formatting (Prettier)

- Print width: 100 characters
- Tab width: 4 spaces (no tabs)
- Semicolons: required
- Quotes: double quotes
- Trailing commas: ES5 compatible
- Arrow function parens: avoid when possible
- Line endings: LF (Unix-style)

### Imports

- Use `src/` prefix for internal modules: `import { foo } from "src/lib/foo.ts";`
- External imports: bare module specifiers
- Group imports: external first, then internal (blank line between)

### Naming Conventions

- **Files**: kebab-case (`my-module.ts`)
- **Classes**: PascalCase (`class Logger`)
- **Functions/variables**: camelCase (`const myVariable`, `function myFunction()`)
- **Interfaces**: PascalCase without "I" prefix (`interface CommandDefinition`)
- **Constants**: UPPER_SNAKE_CASE for true constants, camelCase otherwise
- **Private members**: prefix with underscore (`_privateMethod()`)

### TypeScript Types

- Use explicit types for function parameters and return values
- Prefer interfaces over type aliases for object types
- Use `any` sparingly; prefer `unknown` for truly unknown types
- Use `Record<K, V>` for map-like objects
- Use `Array<T>` syntax consistently (not `T[]`)

### Error Handling

- Commands return `Promise<number>` where 0 = success, 1 = error
- Always wrap command handlers in try/catch blocks
- Use `error()` from `src/utils/logger.ts` for user-facing errors
- Include original error message: `err instanceof Error ? err.message : String(err)`
- Use custom Error instances with descriptive messages
- Never log secrets or keys
- Log important actions with `log()` or `verbose()` from logger

### Code Structure

**Entry Point**: `src/cli.ts` delegates to `src/lib/cli.ts`

**Command Pattern**: Commands follow this structure:

```typescript
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

**File Organization**:

- `src/commands/` - Command definitions
- `src/lib/` - Core functionality and business logic
- `src/utils/` - Utilities (colors, logger, helpers, exec, loader)
- `src/lib/status/` and `src/lib/search/` - Web Workers for parallel processing

### Worker Entrypoints

When adding new Web Workers, update the entrypoints array in `scripts/build.ts`.

### CLI Guidelines

- Use `bun run dev` for testing CLI changes
- Commands should be fast; use caching where appropriate
- Provide helpful error messages
- Support `--help` and `-h` flags on all commands
- Use colored output with `src/utils/logger.ts` functions
- Windows-focused: paths use backslashes, use `process.env.USERPROFILE`

### Build & Bundle

- Uses Bun's native bundler (`Bun.build`)
- Workers are embedded in the executable using Bun's virtual filesystem (`compile: true`)
- Version injected via `SWB_VERSION` environment variable during build
- Production build outputs standalone executable to `dist/swb.exe`
- Always run `bun run build` before committing changes that affect the binary
- Worker URL resolution uses centralized `getWorkerUrl()` helper

### Testing

- Tests use Bun's built-in test runner
- Place test files alongside source files or in a `tests/` directory
- No specific test framework is currently configured

### Dependencies

- Runtime: `mri` for argument parsing
- Dev: `@types/bun`, `prettier`
- Peer: `typescript` (expected to be available in the environment)

### Git Conventions

- Commit messages: concise, present tense ("Add" not "Added")
- One logical change per commit
- No force pushes to main/master
- Create PRs for non-trivial changes
