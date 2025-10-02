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

export function formatLineColumns(lines: string[][], linePrefix = "") {
    // Helper function to strip ANSI color codes and get visual length
    const getVisualLength = (str: string): number => {
        return str.replace(/\u001b\[[0-9;]*m/g, '').length;
    };

    const maxLength: number[] = [];
    for (const line of lines) {
        for (const [i, element] of line.entries()) {
            const visualLength = getVisualLength(element);
            maxLength[i] = Math.max(maxLength[i] || 0, visualLength);
        }
    }
    return lines
        .map((l) =>
            l
                .map((c, i) => {
                    const visualLength = getVisualLength(c);
                    const paddingNeeded = maxLength[i] - visualLength;
                    return linePrefix + c + ' '.repeat(Math.max(0, paddingNeeded));
                })
                .join("  "),
        )
        .join("\n");
}

// Legacy alias for backward compatibility
export const wquote = shellQuote;
