import { error } from "src/utils/logger.ts";
import { formatLineColumns } from "src/utils/helpers.ts";

// Enhanced parsed arguments interface
import mri from "mri";

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

// Enhanced argument parser
export class ArgumentParser {
    private globalOptions: OptionDefinition[] = [
        { flags: "-h, --help", description: "Show help information" },
        { flags: "-V, --version", description: "Show version number" },
        { flags: "-g, --global", description: "Use global scope" },
        { flags: "-v, --verbose", description: "Enable verbose output" },
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

        // Use mri for lightweight argument parsing
        const parsed = mri(argv, {
            boolean: ["help", "version", "verbose", "global", "h", "V", "g", "v", "dry-run"],
            alias: {
                h: "help",
                V: "version",
                g: "global",
                v: "verbose",
            },
        });

        // Extract command from positional arguments
        const positionals = parsed._;
        if (positionals.length > 0 && this.commands.has(positionals[0])) {
            result.command = positionals[0];
            result.args = positionals.slice(1);
        } else {
            result.args = positionals;
        }

        // Extract flags (exclude underscore which contains positional args)
        const { _, ...flags } = parsed;
        result.flags = flags;

        // Set global flags
        result.global.help = !!(flags.help || flags.h);
        result.global.version = !!(flags.version || flags.V || positionals[0] === "version");
        result.global.verbose = !!(flags.verbose || flags.v);
        result.global.global = !!(flags.global || flags.g);

        return result;
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
        } catch (err) {
            error(err instanceof Error ? err.message : String(err));
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
        ];

        // Prepare options table data
        const optionsData: string[][] = [];
        for (const opt of this.globalOptions) {
            optionsData.push([opt.flags, opt.description]);
        }

        // Format options table with 2-space prefix
        const formattedOptions = formatLineColumns(optionsData, "  ");
        lines.push(formattedOptions);

        lines.push("", "Commands:");

        // Prepare commands table data
        const commandsData: string[][] = [];
        for (const [name, cmd] of this.commands) {
            commandsData.push([name, cmd.description]);
        }

        // Format commands table with 2-space prefix
        const formattedCommands = formatLineColumns(commandsData, "  ");
        lines.push(formattedCommands);

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
            const argumentsData: string[][] = [];
            for (const arg of command.arguments) {
                argumentsData.push([arg.name, arg.description]);
            }
            const formattedArguments = formatLineColumns(argumentsData, "  ");
            lines.push(formattedArguments);
            lines.push("");
        }

        if (command.options?.length) {
            lines.push("Options:");
            const optionsData: string[][] = [];
            for (const opt of command.options) {
                optionsData.push([opt.flags, opt.description]);
            }
            const formattedOptions = formatLineColumns(optionsData, "  ");
            lines.push(formattedOptions);
            lines.push("");
        }

        // Add global options
        lines.push("Global Options:");
        const globalOptionsData: string[][] = [];
        for (const opt of this.globalOptions) {
            globalOptionsData.push([opt.flags, opt.description]);
        }
        const formattedGlobalOptions = formatLineColumns(globalOptionsData, "  ");
        lines.push(formattedGlobalOptions);

        return lines.join("\n");
    }

    // Get list of registered commands
    getCommands(): string[] {
        return Array.from(this.commands.keys());
    }
}

// Export a singleton instance
export const parser = new ArgumentParser();
