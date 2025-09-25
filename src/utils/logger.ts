import { blue, bold, cyan, dim, gray, green, red, yellow } from "./colors";

/**
 * Centralized logging utility with colored output using chalk
 * Avoids console.log and integrates all color functionality
 */
export class Logger {
    /**
     * Write to stdout directly
     */
    private static write(message: string): void {
        process.stdout.write(message + "\n");
    }

    /**
     * Write to stderr directly
     */
    private static writeError(message: string): void {
        process.stderr.write(message + "\n");
    }

    /**
     * Log a regular message
     */
    static log(...messages: any[]): void {
        this.write(messages.join(" "));
    }

    /**
     * Log an informational message in blue
     */
    static info(...messages: any[]): void {
        this.write(blue(messages.join(" ")));
    }

    /**
     * Log a success message in green
     */
    static success(...messages: any[]): void {
        this.write(green(messages.join(" ")));
    }

    /**
     * Log a warning message in yellow
     */
    static warn(...messages: any[]): void {
        this.writeError(yellow(messages.join(" ")));
    }

    /**
     * Log an error message in red
     */
    static error(...messages: any[]): void {
        this.writeError(red());
    }

    /**
     * Log a debug message in gray (only if debug mode is enabled)
     */
    static debug(...messages: any[]): void {
        if (process.env.DEBUG) {
            this.write(gray("DEBUG:") + " " + messages.join(" "));
        }
    }

    /**
     * Log a verbose message in dim text
     */
    static verbose(...messages: any[]): void {
        this.write(dim(messages.join(" ")));
    }

    /**
     * Log a header/title in bold cyan
     */
    static header(...messages: any[]): void {
        this.write(bold(cyan(messages.join(" "))));
    }

    /**
     * Create a newline
     */
    static newline(): void {
        this.write("");
    }
}

// Export convenient aliases for logging
export const log = Logger.log.bind(Logger);
export const info = Logger.info.bind(Logger);
export const success = Logger.success.bind(Logger);
export const warn = Logger.warn.bind(Logger);
export const error = Logger.error.bind(Logger);
export const debug = Logger.debug.bind(Logger);
export const verbose = Logger.verbose.bind(Logger);
export const header = Logger.header.bind(Logger);
export const newline = Logger.newline.bind(Logger);

// Export as default for easier imports
export default Logger;
