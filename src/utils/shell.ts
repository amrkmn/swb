/**
 * Shell utilities for Windows environments using Bun
 * 
 * This module provides a comprehensive set of utilities for executing shell commands,
 * working with the file system, and handling common shell operations on Windows.
 * 
 * @deprecated This file is now split into multiple modules for better organization:
 * - exec.ts: Core command execution functionality
 * - filesystem.ts: File system operations
 * - commands.ts: Command utilities
 * - helpers.ts: Helper utilities
 * 
 * Use the individual modules or import from utils/index.ts for the complete API.
 */

// Re-export everything from the modular structure for backward compatibility
export * from "./index.ts";
