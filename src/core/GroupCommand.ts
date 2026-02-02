import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { z } from "zod";

// Group commands don't take args themselves, they route to subcommands.
const EmptySchema = z.object({});

export abstract class GroupCommand extends Command<typeof EmptySchema, typeof EmptySchema> {
    argsSchema = EmptySchema;
    flagsSchema = EmptySchema;

    async run(ctx: Context, _args: any, _flags: any): Promise<number> {
        const { logger } = ctx;

        // Header
        logger.newline();
        logger.log(`Usage: swb ${this.name} <subcommand> [options]`);
        logger.newline();
        logger.log(this.description);
        logger.newline();

        // Subcommands
        logger.log("Subcommands:");
        const maxNameLen = Math.max(...this.subcommands.map(c => c.name.length));

        for (const cmd of this.subcommands) {
            const name = cmd.name.padEnd(maxNameLen + 2);
            logger.log(`  ${name}${cmd.description}`);
        }
        logger.newline();

        // Options (Hardcoded common options for now, can be dynamic later)
        logger.log("Options:");
        logger.log("  --help     Show help for a subcommand");
        logger.log("  --global   Use global scope instead of user scope");
        logger.newline();

        // Examples
        if (this.examples.length > 0) {
            logger.log("Examples:");
            for (const ex of this.examples) {
                logger.log(`  ${ex}`);
            }
            logger.newline();
        }

        // Footer
        logger.log(
            `Run 'swb ${this.name} <subcommand> --help' for more information on a subcommand.`
        );
        logger.newline();

        return 1;
    }

    /**
     * Resolves the correct subcommand to run based on raw input.
     * Note: Parsing logic will be handled in the main CLI entry point,
     * this just provides the structure.
     */
    getSubcommand(name: string): Command | undefined {
        return this.subcommands.find(
            c => c.name === name || (c.aliases && c.aliases.includes(name))
        );
    }
}
