/**
 * General helper utilities for shell operations
 */

function getVisualLength(str: string): number {
    return str.replace(/\u001b\[[0-9;]*m/g, "").length;
}

function truncate(str: string, maxLength: number, fromStart = false): string {
    const visualLen = getVisualLength(str);
    if (visualLen <= maxLength) return str;

    const parts = str.split(/(\u001b\[[0-9;]*m)/);

    if (fromStart) {
        let len = 0;
        let res = "";
        const effectiveMax = Math.max(0, maxLength - 2); // Leave room for "…"

        // Walk from the end and build backwards
        for (let i = parts.length - 1; i >= 0; i--) {
            const part = parts[i];
            if (!part) continue;
            if (part.startsWith("\u001b")) {
                res = part + res;
            } else {
                if (len + part.length > effectiveMax) {
                    const take = Math.max(0, effectiveMax - len);
                    const truncatedPart = part.slice(-take);
                    res = truncatedPart + res;
                    len = maxLength;
                    break;
                }
                res = part + res;
                len += part.length;
            }
        }
        return "…" + res + "\u001b[0m";
    }

    let len = 0;
    let res = "";
    const effectiveMax = Math.max(0, maxLength - 1); // Leave room for ellipsis

    for (const part of parts) {
        if (!part) continue;
        if (part.startsWith("\u001b")) {
            res += part;
        } else {
            if (len + part.length > effectiveMax) {
                const take = Math.max(0, effectiveMax - len);
                res += part.slice(0, take) + "…";
                len = maxLength; // Mark as done
                break;
            }
            res += part;
            len += part.length;
        }
    }

    return res + "\u001b[0m";
}

export interface FormatOptions {
    prefix?: string;
    skipResize?: boolean;
    weights?: number[];
}

export function formatLineColumns(lines: string[][], options: string | FormatOptions = "") {
    const parsedOptions = typeof options === "string" ? { prefix: options } : options;
    const linePrefix = parsedOptions.prefix || "";
    const skipResize = parsedOptions.skipResize || false;
    const customWeights = parsedOptions.weights;

    const maxLength: number[] = [];
    for (const line of lines) {
        for (const [i, element] of line.entries()) {
            const visualLength = getVisualLength(element);
            maxLength[i] = Math.max(maxLength[i] || 0, visualLength);
        }
    }

    // Resize logic to use full terminal width
    if (!skipResize && process.stdout.isTTY && lines.length > 0) {
        const separatorLength = 2; // We use "  " joiner
        const totalPadding = (maxLength.length - 1) * separatorLength;
        const prefixLen = getVisualLength(linePrefix);
        const termWidth = process.stdout.columns || 80;

        // Calculate total content width
        const totalContentWidth = maxLength.reduce((a, b) => a + b, 0);
        const totalWidth = prefixLen + totalContentWidth + totalPadding;

        // Determine weights
        let weights: number[];
        if (customWeights && customWeights.length >= maxLength.length) {
            weights = customWeights.slice(0, maxLength.length);
        } else {
            // Default to equal weights if not provided
            weights = new Array(maxLength.length).fill(1);
        }
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        // If content is wider than terminal, shrink it
        if (totalWidth > termWidth) {
            const availableWidth = termWidth - prefixLen - totalPadding;
            const excess = totalContentWidth - availableWidth;

            for (let i = 0; i < maxLength.length; i++) {
                const proportion =
                    totalWeight > 0 ? weights[i] / totalWeight : 1 / maxLength.length;
                const shrinkAmount = Math.floor(excess * proportion);
                const minWidth = i === 0 ? 12 : 8; // Name needs minimum 12 chars
                maxLength[i] = Math.max(minWidth, maxLength[i] - shrinkAmount);
            }

            // Recalculate total width after weighted shrink
            const newTotalWidth = maxLength.reduce((a, b) => a + b, 0);
            const remainingExcess = newTotalWidth - availableWidth;

            // If still too wide, shrink the largest columns iteratively
            if (remainingExcess > 0) {
                let amountToShrink = remainingExcess;
                while (amountToShrink > 0) {
                    let maxW = 0;
                    let maxIdx = -1;

                    // Find widest column (skip Name column if possible)
                    for (let i = 0; i < maxLength.length; i++) {
                        if (maxLength[i] > maxW) {
                            maxW = maxLength[i];
                            maxIdx = i;
                        }
                    }

                    if (maxIdx === -1) break;

                    const minWidth = maxIdx === 0 ? 12 : 8;
                    const canShrink = Math.max(0, maxLength[maxIdx] - minWidth);
                    if (canShrink === 0) break;

                    const shrinkStep = Math.min(amountToShrink, canShrink);
                    maxLength[maxIdx] -= shrinkStep;
                    amountToShrink -= shrinkStep;
                }
            }
        } else if (totalWidth < termWidth) {
            // Expand to fill terminal width
            const availableSpace = termWidth - totalWidth;

            for (let i = 0; i < maxLength.length; i++) {
                const proportion =
                    totalWeight > 0 ? weights[i] / totalWeight : 1 / maxLength.length;
                const expandAmount = Math.floor(availableSpace * proportion);
                maxLength[i] += expandAmount;
            }

            // Distribute any remaining pixels to Name column (or first column with weight > 0)
            const newTotal = maxLength.reduce((a, b) => a + b, 0);
            const remaining = availableSpace - (newTotal - totalContentWidth);
            if (remaining > 0) {
                // Add remaining pixels to the column with highest weight, or first column
                let targetIdx = 0;
                let maxWeight = -1;
                for (let i = 0; i < weights.length; i++) {
                    if (weights[i] > maxWeight) {
                        maxWeight = weights[i];
                        targetIdx = i;
                    }
                }
                maxLength[targetIdx] += remaining;
            }
        }
    }

    return lines
        .map(l =>
            l
                .map((c, i) => {
                    const targetWidth = maxLength[i];
                    let content = c;

                    if (getVisualLength(content) > targetWidth) {
                        content = truncate(content, targetWidth, false); // Truncate from end
                    }

                    const visualLength = getVisualLength(content);
                    const paddingNeeded = targetWidth - visualLength;

                    return linePrefix + content + " ".repeat(Math.max(0, paddingNeeded));
                })
                .join("  ")
        )
        .join("\n");
}
