/**
 * Core command execution utilities using Bun's $ shell
 */
import { $ } from "bun";

export interface ExecResult {
    /** Process exit code */
    exitCode: number;
    /** Standard output as string */
    stdout: string;
    /** Standard error as string */
    stderr: string;
    /** Whether the command succeeded (exitCode === 0) */
    success: boolean;
    /** Combined stdout and stderr */
    output: string;
}

export interface ExecOptions {
    /** Working directory for the command */
    cwd?: string;
    /** Environment variables to set */
    env?: Record<string, string>;
    /** Whether to throw on non-zero exit codes (default: false) */
    throwOnError?: boolean;
}

/**
 * Converts various buffer/object types to string safely
 */
function toText(val: any): string {
    if (val == null) return "";
    if (typeof val === "string") return val;

    // Handle Uint8Array and ArrayBuffer
    if (val instanceof Uint8Array || val instanceof ArrayBuffer) {
        const bytes = val instanceof ArrayBuffer ? new Uint8Array(val) : val;
        return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    }

    // Fallback to string conversion
    return String(val);
}

/**
 * Execute a shell command via Bun's $ and always return a structured result.
 * Never throws by default - captures all errors in the result object.
 *
 * @example
 * ```typescript
 * const result = await exec$`git status`;
 * if (result.success) {
 *   console.log(result.stdout);
 * } else {
 *   console.error(`Command failed with code ${result.exitCode}: ${result.stderr}`);
 * }
 * ```
 */
export async function exec$(pieces: TemplateStringsArray, ...args: any[]): Promise<ExecResult> {
    return execWithOptions$({}, pieces, ...args);
}

/**
 * Execute a shell command with additional options.
 *
 * @example
 * ```typescript
 * const result = await execWithOptions$({ cwd: '/tmp' })`dir`;
 * ```
 */
export async function execWithOptions$(
    options: ExecOptions,
    pieces: TemplateStringsArray,
    ...args: any[]
): Promise<ExecResult> {
    try {
        // Build the command using Bun's tagged template function
        let cmd = $(pieces, ...args);

        // Apply options
        if (options.cwd) cmd = cmd.cwd(options.cwd);
        if (options.env) cmd = cmd.env(options.env);

        // Execute command - .text() implicitly calls .quiet()
        const stdout = await cmd.text();

        return {
            exitCode: 0,
            stdout: stdout.trim(),
            stderr: "",
            success: true,
            output: stdout.trim(),
        };
    } catch (err: any) {
        const exitCode = err?.exitCode ?? 1;
        const stdout = toText(err?.stdout);
        const stderr = toText(err?.stderr) || err?.message || "";
        const output = [stdout, stderr].filter(Boolean).join("\n");

        const result: ExecResult = {
            exitCode,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            success: false,
            output: output.trim(),
        };

        if (options.throwOnError) {
            const error = new Error(
                `Command failed with exit code ${exitCode}: ${stderr || stdout}`
            );
            (error as any).result = result;
            throw error;
        }

        return result;
    }
}
