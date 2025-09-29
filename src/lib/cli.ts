import { readFile } from "fs/promises";
import { commandRegistry } from "./commands.ts";
import { parser, type CommandDefinition } from "./parser.ts";
import { searchCache } from "./commands/cache.ts";

// Global variable injected during build
import { error, log, warn, debug } from "src/utils/logger.ts";

declare const SWB_VERSION: string;

// Cache for loaded commands to improve performance
const commandCache = new Map<string, CommandDefinition>();

// Binary name for help output
export const binName = "swb";

// Get version - use injected SWB_VERSION from build or fallback to package.json
async function getVersion(): Promise<string> {
    // Check if SWB_VERSION was injected during build
    if (typeof SWB_VERSION !== "undefined") {
        return SWB_VERSION;
    }

    // Fallback to reading from package.json (development mode)
    try {
        const pkgPath = new URL("../../package.json", import.meta.url);
        const content = await readFile(pkgPath, "utf-8");
        const pkg = JSON.parse(content);
        return pkg.version || "unknown";
    } catch {
        return "unknown";
    }
}

// Register all available commands from the static registry
async function registerCommands(): Promise<void> {
    // Register each command from the static registry
    for (const [name, definition] of Object.entries(commandRegistry)) {
        try {
            parser.registerCommand(definition);
            commandCache.set(name, definition);
        } catch (error) {
            warn(
                `Failed to register command '${name}': ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}

// Background cache warming - don't block the CLI
function warmSearchCacheBackground(): void {
    // Fire-and-forget cache warming for better subsequent performance
    searchCache.ensureFreshCache().catch(error => {
        debug(`Background cache warming failed: ${error}`);
    });
}

// Main CLI entry point
export async function runCLI(argv: string[]): Promise<number> {
    try {
        // Register all commands
        await registerCommands();

        // Start background cache warming to improve future search performance
        // This is non-blocking and will run in the background
        warmSearchCacheBackground();

        // Parse arguments
        const parsed = parser.parse(argv);

        // Handle global flags
        if (parsed.global.help && !parsed.command) {
            log(parser.generateHelp());
            return 0;
        }

        if (parsed.global.version) {
            const version = await getVersion();
            log(version);
            return 0;
        }

        // Handle command execution
        if (parsed.command) {
            if (parsed.global.help) {
                log(parser.generateHelp(parsed.command));
                return 0;
            }

            try {
                return await parser.executeCommand(parsed.command, parsed);
            } catch (err) {
                error(err instanceof Error ? err.message : String(err));
                log(parser.generateHelp(parsed.command));
                return 1;
            }
        }

        // No command provided
        if (argv.length === 0) {
            log(parser.generateHelp());
            return 0;
        }

        // Unknown command
        error(`Unknown command: ${argv[0]}`);
        log(parser.generateHelp());
        return 1;
    } catch (err) {
        error(`CLI Error: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }
}

// Print help for a specific command or general help
export function printHelp(commandName?: string): void {
    log(parser.generateHelp(commandName));
}

// Get list of available commands
export function getAvailableCommands(): string[] {
    return parser.getCommands();
}
