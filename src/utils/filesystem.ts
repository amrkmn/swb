/**
 * File system operations using Windows commands
 */
import { execSimple, type ExecResult } from "./exec.ts";

/**
 * Glob-like file matching using Windows dir command.
 * Supports basic wildcards (* and ?) for file pattern matching.
 *
 * @example
 * ```typescript
 * // Find all .ts files in current directory
 * const tsFiles = await glob('*.ts');
 *
 * // Find all files starting with 'test'
 * const testFiles = await glob('test*');
 *
 * // Recursive search for all .js files
 * const allJsFiles = await glob('**\/\*.js');
 * ```
 */
export async function glob(pattern: string, options: { cwd?: string; recursive?: boolean } = {}): Promise<string[]> {
    try {
        const { cwd = ".", recursive = pattern.includes("**") } = options;

        // Convert pattern for Windows dir command
        const cleanPattern = pattern.replace(/\*\*/g, "*").replace(/\//g, "\\");

        let result: ExecResult;

        if (recursive) {
            // Use dir /s for recursive search
            result = await execSimple(`dir ${cleanPattern} /s /b`, cwd !== "." ? cwd : undefined);
        } else {
            // Simple dir command
            result = await execSimple(`dir ${cleanPattern} /b`, cwd !== "." ? cwd : undefined);
        }

        if (result.success && result.stdout.trim()) {
            return result.stdout
                .split("\n")
                .map((line) => line.trim())
                .filter((line) => line && line.length > 0)
                .map((path) => (recursive ? path.replace(/\\/g, "/") : path))
                .sort();
        }

        return [];
    } catch {
        return [];
    }
}