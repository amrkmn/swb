/**
 * Shell utilities for Windows environments using Bun
 * 
 * This module provides a comprehensive set of utilities for executing shell commands,
 * working with the file system, and handling common shell operations on Windows.
 */

// Core execution functionality
export {
    exec$,
    exec$Text,
    execWithOptions$,
    execSimple,
    type ExecResult,
    type ExecOptions,
} from "./exec.ts";

// Command utilities
export {
    commandExists,
    whichCommand,
} from "./commands.ts";

// Helper utilities
export {
    shellQuote,
    escapeRegex,
    sleep,
    wquote, // Legacy alias
} from "./helpers.ts";