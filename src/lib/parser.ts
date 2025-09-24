// Enhanced parsed arguments interface
export interface ParsedArgs {
    command?: string;
    subcommand?: string;
    args: string[];
    flags: Record<string, any>;
    global: {
        help: boolean;
        version: boolean;
        verbose: boolean;
        global: boolean;
    };
}

// Command definition interface
export interface CommandDefinition {
    name: string;
    description: string;
    arguments?: ArgumentDefinition[];
    options?: OptionDefinition[];
    subcommands?: CommandDefinition[];
    handler: CommandHandler;
}

export interface ArgumentDefinition {
    name: string;
    description: string;
    required?: boolean;
    variadic?: boolean;
}

export interface OptionDefinition {
    flags: string;
    description: string;
    defaultValue?: any;
    choices?: string[];
}

export type CommandHandler = (args: ParsedArgs) => Promise<number> | number;

// Utility function to coerce string values to appropriate types
function coerceValue(value: string): any {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (value === "undefined") return undefined;

    // Try to parse as number
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== "") {
        return num;
    }

    return value;
}

// Enhanced argument parser
export class ArgumentParser {
    private globalOptions: OptionDefinition[] = [
        { flags: "-h, --help", description: "Show help information" },
        { flags: "-v, --version", description: "Show version number" },
        { flags: "-g, --global", description: "Use global scope" },
        { flags: "--verbose", description: "Enable verbose output" },
    ];

    private commands: Map<string, CommandDefinition> = new Map();

    // Register a command
    registerCommand(definition: CommandDefinition): void {
        this.commands.set(definition.name, definition);
    }

    // Parse command line arguments
    parse(argv: string[]): ParsedArgs {
        const result: ParsedArgs = {
            args: [],
            flags: {},
            global: {
                help: false,
                version: false,
                verbose: false,
                global: false,
            },
        };

        if (argv.length === 0) {
            result.global.help = true;
            return result;
        }

        // Check for global help/version first
        if (argv.includes("-h") || argv.includes("--help")) {
            result.global.help = true;
        }
        if (argv.includes("-v") || argv.includes("--version") || argv[0] === "version") {
            result.global.version = true;
        }
        if (argv.includes("--verbose")) {
            result.global.verbose = true;
        }
        if (argv.includes("-g") || argv.includes("--global")) {
            result.global.global = true;
        }

        // Extract command
        const firstArg = argv[0];
        if (firstArg && !firstArg.startsWith("-") && this.commands.has(firstArg)) {
            result.command = firstArg;
            argv = argv.slice(1); // Remove command from args
        }

        // Parse flags and arguments
        const { flags, positionals } = this.parseFlags(argv);
        result.flags = flags;
        result.args = positionals;

        // Update global flags from parsed flags
        if (flags.help) result.global.help = true;
        if (flags.version) result.global.version = true;
        if (flags.verbose) result.global.verbose = true;
        if (flags.global) result.global.global = true;

        return result;
    }

    // Parse flags and positional arguments
    private parseFlags(argv: string[]): { flags: Record<string, any>; positionals: string[] } {
        const flags: Record<string, any> = {};
        const positionals: string[] = [];

        for (let i = 0; i < argv.length; i++) {
            const arg = argv[i];

            if (arg === "--") {
                // Everything after -- is positional
                positionals.push(...argv.slice(i + 1));
                break;
            }

            if (arg.startsWith("--")) {
                // Long flag
                const eqIndex = arg.indexOf("=");
                if (eqIndex > 0) {
                    // --key=value
                    const key = arg.slice(2, eqIndex);
                    const value = arg.slice(eqIndex + 1);
                    flags[key] = coerceValue(value);
                } else {
                    // --key [value]
                    const key = arg.slice(2);
                    const nextArg = argv[i + 1];
                    if (nextArg && !nextArg.startsWith("-")) {
                        flags[key] = coerceValue(nextArg);
                        i++; // Skip next arg
                    } else {
                        flags[key] = true;
                    }
                }
            } else if (arg.startsWith("-") && arg.length > 1) {
                // Short flag(s)
                const shortFlags = arg.slice(1);
                for (let j = 0; j < shortFlags.length; j++) {
                    const flag = shortFlags[j];
                    if (j === shortFlags.length - 1) {
                        // Last flag in group, might have value
                        const nextArg = argv[i + 1];
                        if (nextArg && !nextArg.startsWith("-")) {
                            flags[flag] = coerceValue(nextArg);
                            i++; // Skip next arg
                        } else {
                            flags[flag] = true;
                        }
                    } else {
                        flags[flag] = true;
                    }
                }
            } else {
                // Positional argument
                positionals.push(arg);
            }
        }

        return { flags, positionals };
    }

    // Execute a command
    async executeCommand(commandName: string, args: ParsedArgs): Promise<number> {
        const command = this.commands.get(commandName);
        if (!command) {
            throw new Error(`Unknown command: ${commandName}`);
        }

        try {
            const result = await command.handler(args);
            return typeof result === "number" ? result : 0;
        } catch (error) {
            console.error(error instanceof Error ? error.message : String(error));
            return 1;
        }
    }

    // Generate help text
    generateHelp(commandName?: string): string {
        if (commandName) {
            const command = this.commands.get(commandName);
            if (!command) {
                return `Unknown command: ${commandName}`;
            }
            return this.generateCommandHelp(command);
        }

        return this.generateGlobalHelp();
    }

    private generateGlobalHelp(): string {
        const lines = [
            "Usage: swb [options] <command> [command-options]",
            "",
            "A JavaScript implementation of Scoop using Bun's runtime",
            "",
            "Options:",
            ...this.globalOptions.map(opt => `  ${opt.flags.padEnd(20)} ${opt.description}`),
            "",
            "Commands:",
        ];

        for (const [name, cmd] of this.commands) {
            lines.push(`  ${name.padEnd(20)} ${cmd.description}`);
        }

        lines.push("");
        lines.push("Run 'swb <command> --help' for more information on a command.");

        return lines.join("\n");
    }

    private generateCommandHelp(command: CommandDefinition): string {
        const lines = [`Usage: swb ${command.name}`];

        if (command.arguments?.length) {
            const argStr = command.arguments
                .map(arg => {
                    const name = arg.variadic ? `...${arg.name}` : arg.name;
                    return arg.required ? `<${name}>` : `[${name}]`;
                })
                .join(" ");
            lines[0] += ` ${argStr}`;
        }

        lines.push("", command.description, "");

        if (command.arguments?.length) {
            lines.push("Arguments:");
            for (const arg of command.arguments) {
                lines.push(`  ${arg.name.padEnd(20)} ${arg.description}`);
            }
            lines.push("");
        }

        if (command.options?.length) {
            lines.push("Options:");
            for (const opt of command.options) {
                lines.push(`  ${opt.flags.padEnd(20)} ${opt.description}`);
            }
            lines.push("");
        }

        // Add global options
        lines.push("Global Options:");
        for (const opt of this.globalOptions) {
            lines.push(`  ${opt.flags.padEnd(20)} ${opt.description}`);
        }

        return lines.join("\n");
    }

    // Get list of registered commands
    getCommands(): string[] {
        return Array.from(this.commands.keys());
    }
}

// Export a singleton instance
export const parser = new ArgumentParser();
