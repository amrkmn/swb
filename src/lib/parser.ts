import { error } from "src/utils/logger.ts";

// Enhanced parsed arguments interface
import yargsParser from "yargs-parser";

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

        // Use yargs-parser for lightweight argument parsing
        const parsed = yargsParser(argv, {
            boolean: ["help", "version", "verbose", "global", "h", "v", "g"],
            alias: {
                h: "help",
                v: "version",
                g: "global",
            },
            configuration: {
                "parse-numbers": true,
                "parse-positional-numbers": true,
                "camel-case-expansion": false,
                "dot-notation": false,
            },
        });

        // Extract command from positional arguments
        const positionals = parsed._ as string[];
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
        result.global.version = !!(flags.version || flags.v || positionals[0] === "version");
        result.global.verbose = !!flags.verbose;
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
