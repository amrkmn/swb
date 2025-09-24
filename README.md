# Scoop-with-Bun (SWB)

> A fast JavaScript implementation of Scoop package manager using Bun runtime

[![Bun](https://img.shields.io/badge/Bun-≥1.2.0-black?logo=bun)](https://bun.com)
[![Windows](https://img.shields.io/badge/Platform-Windows-blue?logo=windows)](https://www.microsoft.com/windows)

## What is SWB?

SWB is a modern reimplementation of the [Scoop](https://scoop.sh/) Windows package manager, built with [Bun](https://bun.com) and TypeScript. It provides fast package management for Windows with native shell integration.

## Requirements

- **Windows** (this tool is Windows-only)
- **Bun ≥1.2.0** - [Install Bun](https://bun.com/docs/installation)

## Quick Start

```bash
# Clone and install
git clone https://github.com/amrkmn/swb
cd swb
bun install

# Development
bun run dev

# Build
bun run build
```

## Development

```bash
bun run dev    # Run in development
bun test       # Run tests
bun run build  # Build for production
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `bun test` and `bun run build`
5. Submit a pull request

## License

Apache 2.0

---

**Built with [Bun](https://bun.com) for Windows**
