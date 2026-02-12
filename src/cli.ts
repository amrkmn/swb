import mri from "mri";
import { BucketCommand } from "src/commands/bucket/index";
import { CleanupCommand } from "src/commands/cleanup/index";
import { ConfigCommand } from "src/commands/config/index";
import { InfoCommand } from "src/commands/info/index";
import { ListCommand } from "src/commands/list/index";
import { PrefixCommand } from "src/commands/prefix/index";
import { SearchCommand } from "src/commands/search/index";
import { StatusCommand } from "src/commands/status/index";
import { VersionCommand } from "src/commands/version/index";
import { WhichCommand } from "src/commands/which/index";
import type { Command } from "src/core/Command";
import type { Context, Logger } from "src/core/Context";
import { GroupCommand } from "src/core/GroupCommand";
import { AppsService } from "src/services/AppsService";
import { BucketService } from "src/services/BucketService";
import { CleanupService } from "src/services/CleanupService";
import { ConfigService } from "src/services/ConfigService";
import { ManifestService } from "src/services/ManifestService";
import { ShimService } from "src/services/ShimService";
import { WorkerService } from "src/services/WorkerService";
import { debug, error, header, info, log, newline, success, verbose, warn } from "src/utils/logger";
import { getVersion } from "src/utils/version";
import { z, ZodError } from "zod";

// 1. Setup Context
const logger: Logger = {
    log,
    info,
    success,
    warn,
    error,
    debug,
    verbose,
    header,
    newline,
};

async function createContext(): Promise<Context> {
    const version = await getVersion();

    // We use a getter or late initialization for circular deps if needed,
    // but here we just construct them.
    const context: Context = {
        version,
        logger,
        verbose: false,
        services: {
            workers: null as any,
            buckets: null as any,
            apps: null as any,
            config: null as any,
            cleanup: null as any,
            manifests: null as any,
            shims: null as any,
        },
    };

    context.services.workers = new WorkerService(context);
    context.services.buckets = new BucketService(context);
    context.services.apps = new AppsService(context);
    context.services.config = new ConfigService(context);
    context.services.cleanup = new CleanupService(context);
    context.services.manifests = new ManifestService(context);
    context.services.shims = new ShimService(context);

    return context;
}

// 2. Register Commands
const commands = new Map<string, Command>();

const searchCmd = new SearchCommand();
commands.set(searchCmd.name, searchCmd);

const bucketCmd = new BucketCommand();
commands.set(bucketCmd.name, bucketCmd);

const listCmd = new ListCommand();
commands.set(listCmd.name, listCmd);

const infoCmd = new InfoCommand();
commands.set(infoCmd.name, infoCmd);

const configCmd = new ConfigCommand();
commands.set(configCmd.name, configCmd);

const prefixCmd = new PrefixCommand();
commands.set(prefixCmd.name, prefixCmd);

const whichCmd = new WhichCommand();
commands.set(whichCmd.name, whichCmd);

const statusCmd = new StatusCommand();
commands.set(statusCmd.name, statusCmd);

const versionCmd = new VersionCommand();
commands.set(versionCmd.name, versionCmd);

const cleanupCmd = new CleanupCommand();
commands.set(cleanupCmd.name, cleanupCmd);

// 3. Parse Arguments
const argv = process.argv.slice(2);

// Initial parse to find the command name
const initialParsed = mri(argv);
const commandName = initialParsed._[0];
let command = commands.get(commandName);

function getMriOptions(cmd: Command) {
    const alias: Record<string, string> = { h: "help" };
    const boolean: string[] = ["help"];

    // Add command-specific aliases
    if (cmd.flagAliases) {
        Object.assign(alias, cmd.flagAliases);
    }

    // Inspect Zod schema for booleans
    if (cmd.flagsSchema instanceof z.ZodObject) {
        const shape = cmd.flagsSchema.shape;
        for (const key of Object.keys(shape)) {
            const type = shape[key];
            // Check for ZodBoolean (including wrapped in Default/Optional)
            let isBool = false;
            let curr = type;
            while (curr) {
                if (curr instanceof z.ZodBoolean) {
                    isBool = true;
                    break;
                }
                if (curr instanceof z.ZodDefault || curr instanceof z.ZodOptional) {
                    curr = curr._def.innerType;
                } else {
                    break;
                }
            }

            if (isBool) {
                boolean.push(key);
            }
        }
    }

    return { alias, boolean };
}

function printHelp() {
    header("swb - Scoop With Bun (v2)");
    newline();
    info("Usage: swb <command> [options]");
    newline();
    info("Available commands:");
    for (const [name, cmd] of commands.entries()) {
        log(`  ${name.padEnd(12)} ${cmd.description}`);
    }
    newline();
    log("Options:");
    log("  -h, --help     Show help");
    log("  -v, --verbose  Show verbose output");
    log("  -g, --global   Global install scope");
}

async function run() {
    const context = await createContext();

    // 1. General Help (swb, swb -h, or swb --help)
    if (!command) {
        if (!commandName || initialParsed.help || initialParsed.h) {
            printHelp();
            process.exit(0);
        }

        logger.error(`Unknown command: ${commandName}`);
        printHelp();
        process.exit(1);
    }

    // 2. Handle Group Commands & Subcommands logic *before* final parsing
    let targetCommand = command;
    let subArgs = argv; // Default to full args if not group

    if (command instanceof GroupCommand) {
        const subCmdName = initialParsed._[1]; // Subcommand should be second arg
        if (subCmdName) {
            const subCmd = command.getSubcommand(subCmdName);
            if (subCmd) {
                targetCommand = subCmd;
            }
        }
    }

    // 3. Final Parse with Command-Specific Options
    const mriOpts = getMriOptions(targetCommand);
    // Add global flags to mri options
    mriOpts.alias["v"] = "verbose";
    mriOpts.boolean.push("verbose");

    // Also add global 'g' for global if it's not already handled?
    // Wait, some commands might use 'g' for something else?
    // In V1, global flags were verbose/help/global.
    // Let's add 'g' -> 'global' as well globally if not conflicting.
    // If a command has 'g' alias for something else, it overrides this.
    if (!mriOpts.alias["g"]) {
        mriOpts.alias["g"] = "global";
        mriOpts.boolean.push("global");
    }

    const parsed = mri(argv, mriOpts);

    // Set global context values
    context.verbose = parsed.verbose || false;

    // 4. Help Check
    if (parsed.help) {
        // If it's a group command but we didn't resolve a specific subcommand above (or even if we did?),
        // we might want to show help for the target.
        // Actually, logic below handles it.
        if (command instanceof GroupCommand && targetCommand !== command) {
            await targetCommand.help(context);
        } else if (command instanceof GroupCommand) {
            // Root group command help
            await command.run(context, {}, {});
        } else {
            await command.help(context);
        }
        process.exit(0);
    }

    // Helper to map array to object based on schema keys
    function mapArgs(schema: z.ZodTypeAny, args: string[]): any {
        if (schema instanceof z.ZodObject) {
            const shape = schema.shape;
            const keys = Object.keys(shape);
            const result: Record<string, any> = {};

            args.forEach((val, idx) => {
                if (keys[idx]) {
                    result[keys[idx]] = val;
                }
            });
            return result;
        }
        return {};
    }

    // Dispatch
    if (command instanceof GroupCommand) {
        const subCmdName = parsed._[1];
        if (!subCmdName) {
            // Run group command (help)
            await command.run(context, {}, {});
            process.exit(1);
        }

        const subCmd = command.getSubcommand(subCmdName);
        if (!subCmd) {
            logger.error(`Unknown subcommand: ${commandName} ${subCmdName}`);
            await command.run(context, {}, {});
            process.exit(1);
        }

        // Subcommand Args: Remove command and subcommand from positional args
        const cmdArgs = parsed._.slice(2);
        const mappedArgs = mapArgs(subCmd.argsSchema, cmdArgs);

        try {
            const validatedArgs = subCmd.argsSchema.parse(mappedArgs);
            const validatedFlags = subCmd.flagsSchema.parse(parsed);

            const exitCode = await subCmd.run(context, validatedArgs, validatedFlags);
            process.exit(exitCode);
        } catch (err) {
            // ... Error handling ...
            if (err instanceof ZodError) {
                const issues = err.issues;
                if (issues && Array.isArray(issues)) {
                    issues.forEach((e: any) => {
                        if (
                            e.code === "invalid_type" &&
                            (e.received === "undefined" || e.received === undefined)
                        ) {
                            if (e.path.includes("query")) {
                                logger.error("Search query is required");
                            } else {
                                logger.error(`${e.path.join(".")} is required`);
                            }
                        } else {
                            logger.error(e.message);
                        }
                    });
                } else {
                    logger.error(`Validation Error: ${err.message}`);
                }
            } else {
                logger.error(`Error: ${err}`);
            }
            process.exit(1);
        }
    } else {
        // Standard Command
        const cmdArgs = parsed._.slice(1);
        const mappedArgs = mapArgs(command.argsSchema, cmdArgs);

        try {
            const validatedArgs = command.argsSchema.parse(mappedArgs);
            const validatedFlags = command.flagsSchema.parse(parsed);

            const exitCode = await command.run(context, validatedArgs, validatedFlags);
            process.exit(exitCode);
        } catch (err) {
            // ... Error handling (same as above) ...
            if (err instanceof ZodError) {
                const issues = err.issues;
                if (issues && Array.isArray(issues)) {
                    issues.forEach((e: any) => {
                        if (
                            e.code === "invalid_type" &&
                            (e.received === "undefined" || e.received === undefined)
                        ) {
                            if (e.path.includes("query")) {
                                logger.error("Search query is required");
                            } else {
                                logger.error(`${e.path.join(".")} is required`);
                            }
                        } else {
                            logger.error(e.message);
                        }
                    });
                } else {
                    logger.error(`Validation Error: ${err.message}`);
                }
            } else {
                logger.error(`Error: ${err}`);
            }
            process.exit(1);
        }
    }
}

run();
