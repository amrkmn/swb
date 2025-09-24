/**
 * General helper utilities for shell operations
 */

/**
 * Quote a path or argument for shell execution if needed.
 * Handles Windows shell quoting.
 *
 * @example
 * ```typescript
 * const path = shellQuote("C:\\Program Files\\Git\\bin\\git.exe");
 * // Returns: "C:\\Program Files\\Git\\bin\\git.exe"
 * ```
 */
export function shellQuote(value: string): string {
    if (!value) return '""';

    // Windows-specific quoting: check if quoting is needed
    if (/[ &()^%!"]/.test(value)) {
        // Escape existing quotes and wrap in quotes
        return `"${value.replace(/"/g, '\\"')}"`;
    }

    return value;
}

/**
 * Escape a string for use in a regular expression.
 */
export function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Sleep for a specified number of milliseconds.
 * Useful for adding delays in shell command sequences.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Legacy alias for backward compatibility
export const wquote = shellQuote;
