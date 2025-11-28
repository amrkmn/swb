/**
 * Color utilities using ANSI escape codes for consistent CLI output styling
 */

const wrap =
    (open: string, close: string) =>
    (str: string): string =>
        `\x1b[${open}m${str}\x1b[${close}m`;

// Basic colors
export const red = wrap("31", "39");
export const green = wrap("32", "39");
export const yellow = wrap("33", "39");
export const blue = wrap("34", "39");
export const cyan = wrap("36", "39");
export const magenta = wrap("35", "39");
export const gray = wrap("90", "39");
export const white = wrap("37", "39");

// Styled outputs
export const error = red;
export const success = green;
export const warning = yellow;
export const info = blue;
export const highlight = cyan;
export const dim = wrap("2", "22");
export const bold = wrap("1", "22");
export const underline = wrap("4", "24");
