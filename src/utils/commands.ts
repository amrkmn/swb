/**
 * Command existence and discovery utilities
 */
import { exec$ } from "./exec.ts";

/**
 * Check if a command exists and is executable.
 *
 * @example
 * ```typescript
 * if (await commandExists("git")) {
 *   console.log("Git is available");
 * }
 * ```
 */
export async function commandExists(command: string): Promise<boolean> {
    try {
        const result = await exec$`where.exe ${command}`;
        return result.success && result.stdout.trim().length > 0;
    } catch {
        return false;
    }
}

/**
 * Get the full path to an executable command.
 * Returns null if the command is not found.
 */
export async function whichCommand(command: string): Promise<string | null> {
    try {
        const result = await exec$`where.exe ${command}`;

        if (result.success && result.stdout.trim()) {
            // 'where.exe' might return multiple paths - take the first one
            return result.stdout.split("\n")[0].trim();
        }
        return null;
    } catch {
        return null;
    }
}