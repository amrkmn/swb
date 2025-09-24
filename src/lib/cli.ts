import { readFile } from "fs/promises";
import { parser, type CommandDefinition } from "./parser.ts";
import { commandRegistry, getCommandDefinition } from "./commands.ts";

// Global variable injected during build
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

// Load a command from the static registry
async function loadCommand(name: string): Promise<CommandDefinition> {
    const cached = commandCache.get(name);
    if (cached) return cached;

    const definition = getCommandDefinition(name);
    if (!definition) {
        throw new Error(`Unknown command: ${name}`);
    }

    commandCache.set(name, definition);
    return definition;
}

// Register all available commands from the static registry
async function registerCommands(): Promise<void> {
    // Register each command from the static registry
    for (const [name, definition] of Object.entries(commandRegistry)) {
        try {
            parser.registerCommand(definition);
            commandCache.set(name, definition);
        } catch (error) {
            console.warn(`Warning: Failed to register command '${name}': ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

// Main CLI entry point
export async function runCLI(argv: string[]): Promise<number> {
    try {
        // Register all commands
        await registerCommands();

        // Parse arguments
        const parsed = parser.parse(argv);

        // Handle global flags
        if (parsed.global.help && !parsed.command) {
            console.log(parser.generateHelp());
            return 0;
        }

        if (parsed.global.version) {
            const version = await getVersion();
            console.log(version);
            return 0;
        }

        // Handle command execution
        if (parsed.command) {
            if (parsed.global.help) {
                console.log(parser.generateHelp(parsed.command));
                return 0;
            }

            try {
                return await parser.executeCommand(parsed.command, parsed);
            } catch (error) {
                console.error(error instanceof Error ? error.message : String(error));
                console.log(parser.generateHelp(parsed.command));
                return 1;
            }
        }

        // No command provided
        if (argv.length === 0) {
            console.log(parser.generateHelp());
            return 0;
        }

        // Unknown command
        console.error(`Unknown command: ${argv[0]}`);
        console.log(parser.generateHelp());
        return 1;
    } catch (error) {
        console.error(`CLI Error: ${error instanceof Error ? error.message : String(error)}`);
        return 1;
    }
}

// Print help for a specific command or general help
export function printHelp(commandName?: string): void {
    console.log(parser.generateHelp(commandName));
}

// Get list of available commands
export function getAvailableCommands(): string[] {
    return parser.getCommands();
}
