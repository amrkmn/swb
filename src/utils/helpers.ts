/**
 * General helper utilities for shell operations
 */

export function formatLineColumns(lines: string[][], linePrefix = "") {
    // Helper function to strip ANSI color codes and get visual length
    const getVisualLength = (str: string): number => {
        return str.replace(/\u001b\[[0-9;]*m/g, "").length;
    };

    const maxLength: number[] = [];
    for (const line of lines) {
        for (const [i, element] of line.entries()) {
            const visualLength = getVisualLength(element);
            maxLength[i] = Math.max(maxLength[i] || 0, visualLength);
        }
    }
    return lines
        .map(l =>
            l
                .map((c, i) => {
                    const visualLength = getVisualLength(c);
                    const paddingNeeded = maxLength[i] - visualLength;
                    return linePrefix + c + " ".repeat(Math.max(0, paddingNeeded));
                })
                .join("  ")
        )
        .join("\n");
}
