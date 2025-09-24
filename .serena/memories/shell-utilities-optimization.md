# Shell Utilities Optimization (utils/shell.ts)

## Overview
The `src/utils/shell.ts` file provides Windows-specific shell execution utilities built on top of Bun's `$` shell. This file has been optimized specifically for Windows environments, removing cross-platform complexity.

## Key Functions

### Core Execution Functions
- **`exec$()`**: Basic shell command execution with structured result
- **`exec$Text()`**: Simplified execution that returns only stdout or throws
- **`execWithOptions$()`**: Advanced execution with options (cwd, env, error handling)

### Windows Command Utilities
- **`commandExists(command: string)`**: Check if a Windows command exists using `where.exe`
- **`whichCommand(command: string)`**: Get full path to Windows executable using `where.exe`

### String/Path Utilities
- **`shellQuote(value: string)`**: Windows-specific shell argument quoting
- **`escapeRegex(string: string)`**: Regex escaping utility
- **`sleep(ms: number)`**: Promise-based delay utility
- **`wquote`**: Legacy alias for `shellQuote`

## Interfaces

### ExecResult
```typescript
export interface ExecResult {
    exitCode: number;       // Process exit code
    stdout: string;         // Standard output
    stderr: string;         // Standard error  
    success: boolean;       // exitCode === 0
    output: string;         // Combined stdout + stderr
}
```

### ExecOptions
```typescript
export interface ExecOptions {
    cwd?: string;                    // Working directory
    env?: Record<string, string>;    // Environment variables
    throwOnError?: boolean;          // Throw on non-zero exit codes
}
```

## Windows-Specific Optimizations Made

1. **Removed Cross-Platform Logic**: Eliminated all `process.platform` checks
2. **Direct Windows Command Usage**: Uses `where.exe` directly instead of conditional Unix/Windows commands
3. **Windows-Only Shell Quoting**: Simplified quoting logic for Windows cmd/PowerShell
4. **Streamlined Error Handling**: Removed Unix-specific error handling paths
5. **Reduced Code Complexity**: ~40 lines of cross-platform code eliminated

## Usage Patterns

### Basic Command Execution
```typescript
const result = await exec$`dir C:\\`;
if (result.success) {
    console.log(result.stdout);
}
```

### Command Detection
```typescript
if (await commandExists('git')) {
    const gitPath = await whichCommand('git');
    console.log(`Git found at: ${gitPath}`);
}
```

### Safe Argument Quoting
```typescript
const quotedPath = shellQuote('C:\\Program Files\\App\\app.exe');
// Returns: "C:\\Program Files\\App\\app.exe"
```

## Dependencies
- **Bun's `$` shell**: Core shell execution functionality
- **Windows `where.exe`**: Command resolution (built into Windows)

## Performance Benefits
- No runtime platform detection overhead
- Simpler code paths for Windows-only execution
- Reduced bundle size from eliminated cross-platform code
- Direct Windows command usage without abstraction layers