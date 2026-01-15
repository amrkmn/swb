# Scoop-with-Bun (SWB)

> A fast TypeScript/JavaScript reimplementation of Scoop package manager using Bun runtime

[![Bun](https://img.shields.io/badge/Bun-≥1.2.0-black?logo=bun)](https://bun.com)
[![Windows](https://img.shields.io/badge/Platform-Windows-blue?logo=windows)](https://www.microsoft.com/windows)
[![TypeScript](https://img.shields.io/badge/TypeScript-ES2022-blue?logo=typescript)](https://www.typescriptlang.org/)

## What is SWB?

SWB (Scoop With Bun) is a fast, modern reimplementation of the [Scoop](https://scoop.sh/) Windows package manager, built with [Bun](https://bun.com) and TypeScript. It provides lightning-fast package management for Windows with parallel search processing and full Scoop compatibility.

## Installation

```bash
# Add the amrkmn bucket
scoop bucket add amrkmn https://github.com/amrkmn/baldi

# Install swb
scoop install amrkmn/swb
```

## Development

For development from source:

```bash
# Requirements: Bun ≥1.2.0
git clone https://github.com/amrkmn/swb
cd swb
bun install

# Run in development mode
bun run dev

# Build standalone executable
bun run build
```

## Available Commands

### Package Management

```bash
swb search <query>     # Search for packages with optimized performance
swb info <package>     # Get detailed package information
swb list [filter]      # List installed packages
swb which <command>    # Find executable locations with shim resolution
```

### Bucket Management

Buckets are repositories containing app manifests. SWB provides powerful bucket management with parallel operations.

```bash
# List installed buckets
swb bucket list              # Show all installed buckets with metadata
swb bucket list --json       # Output in JSON format

# Add buckets
swb bucket add extras        # Add a known bucket
swb bucket add mybucket https://github.com/user/bucket  # Add from URL

# Remove buckets
swb bucket remove extras --force   # Remove a bucket (requires --force)
swb bucket rm extras -f            # Short alias

# Discover buckets
swb bucket known             # List all officially recognized buckets
swb bucket known --json      # Output in JSON format

# Update buckets
swb bucket update            # Update all buckets in parallel
swb bucket update extras     # Update specific bucket
swb bucket update --changelog # Show commit messages for updates

# Find unused buckets
swb bucket unused            # List buckets with no installed apps
swb bucket unused --json     # Output in JSON format
```

**Features:**

- Parallel operations using web workers for maximum performance
- Individual progress display for each bucket during updates
- Full compatibility with Scoop bucket structure
- Supports both user and global scopes with `--global` flag

### System Management

```bash
swb status            # Show installation status
swb config            # Configuration management
swb prefix <package>  # Show package installation paths
swb cleanup           # Clean up Scoop installation artifacts
```

## License

Apache 2.0
