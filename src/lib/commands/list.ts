import { cyan, dim, green } from "src/utils/colors.ts";

export function formatRow(name: string, version: string, flags: string[]): string {
    const flagStr = flags.length > 0 ? ` ${dim(`[${flags.join(", ")}]`)}` : "";
    return `${cyan(name)} ${green(version)}${flagStr}`;
}