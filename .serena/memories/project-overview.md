# Scoop-with-Bun (SWB) Project Overview

## Project Description

Scoop With Bun (swb) is a JavaScript implementation of Scoop (Windows package manager) using Bun's runtime and shell capabilities. This is a Windows-specific CLI tool that reimplements Scoop functionality in TypeScript/JavaScript.

## Key Technologies

- **Runtime**: Bun (>=1.1.0)
- **Language**: TypeScript with ES modules
- **CLI Framework**: Commander.js
- **Target Platform**: Windows only
- **Shell Integration**: Bun's `$` shell for executing Windows commands

## Project Structure

```
src/
├── cli.ts              # Main CLI entry point
├── commands/           # Individual CLI commands
│   ├── config.ts
│   ├── info.ts
│   ├── list.ts
│   ├── prefix.ts
│   └── which.ts
├── lib/                # Core library functions
│   ├── apps.ts
│   ├── cli.ts
│   ├── manifests.ts
│   ├── parser.ts
│   ├── paths.ts
│   └── which.ts
├── templates/          # Code generation templates
│   ├── command.ts
│   └── new-command.ts
└── utils/              # Utility functions
    └── shell.ts        # Windows-specific shell utilities
```

## Build and Distribution

- **Binary name**: `swb`
- **Build target**: Bun runtime
- **Output**: `dist/cli.js`
- **Development**: `bun run src/cli.ts`
- **Build**: `bun build --target bun --sourcemap --outdir dist src/cli.ts`

## Key Features

Based on the structure, SWB implements core Scoop functionality:

- Package information and listing
- Configuration management
- Application path resolution
- Manifest parsing
- Command-line interface with multiple subcommands

## Windows-Specific Design

The project is explicitly designed for Windows environments, leveraging Windows-specific commands like `where.exe` and Windows path conventions.
