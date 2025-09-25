/**
 * Color utilities using chalk for consistent CLI output styling
 */
import chalk from "chalk";

// Basic colors
export const red = chalk.red;
export const green = chalk.green;
export const yellow = chalk.yellow;
export const blue = chalk.blue;
export const cyan = chalk.cyan;
export const magenta = chalk.magenta;
export const gray = chalk.gray;
export const white = chalk.white;

// Styled outputs
export const error = red;
export const success = green;
export const warning = yellow;
export const info = blue;
export const highlight = cyan;
export const dim = chalk.dim;
export const bold = chalk.bold;
export const underline = chalk.underline;
