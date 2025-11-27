/**
 * Command existence and discovery utilities
 */
import { exec$ } from "./exec.ts";

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
