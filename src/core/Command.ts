import type { Context } from "src/core/Context";
import { z } from "zod";

export abstract class Command<
    Args extends z.ZodTypeAny = z.ZodTypeAny,
    Flags extends z.ZodTypeAny = z.ZodTypeAny,
> {
    abstract name: string;
    abstract description: string;

    // Optional schemas (default to "any" if not provided)
    abstract argsSchema: Args;
    abstract flagsSchema: Flags;

    // Subcommands (optional, used by GroupCommand)
    subcommands: Command[] = [];

    // Documentation
    examples: string[] = [];
    aliases: string[] = [];

    /**
     * Optional explicit alias mapping for help display.
     * Format: { "short": "long" } e.g. { "a": "all" }
     */
    flagAliases: Record<string, string> = {};

    /**
     * Print help information for this command.
     */
    async help(ctx: Context): Promise<number> {
        const { logger } = ctx;

        logger.newline();
        logger.log(`Usage: swb ${this.name} [options] [arguments]`);
        logger.newline();
        logger.log(this.description);
        logger.newline();

        // argsSchema introspection could be added here if needed to list arguments

        // Introspect flagsSchema
        if (this.flagsSchema instanceof z.ZodObject) {
            const shape = this.flagsSchema.shape;
            const keys = Object.keys(shape);

            const lines: { flags: string; desc: string }[] = [];
            const processed = new Set<string>();

            // Add manual options
            processed.add("verbose");
            lines.push({ flags: "-h, --help", desc: "Show help for a command" });
            lines.push({ flags: "-v, --verbose", desc: "Show verbose output" });

            // 1. Process explicit aliases first
            for (const [short, long] of Object.entries(this.flagAliases)) {
                if (keys.includes(long)) {
                    if (long === "verbose") continue;

                    const schema = shape[long];
                    // Unwrap optional/default to get description if needed,
                    // though Zod usually puts description on the outer wrapper if .describe() is called last.
                    // But if .default() is called last, description might be on that.
                    const desc = schema.description || schema._def.innerType?.description || "";

                    lines.push({ flags: `-${short}, --${long}`, desc });
                    processed.add(short);
                    processed.add(long);
                }
            }

            // 2. Process remaining keys
            for (const key of keys) {
                if (processed.has(key)) continue;

                const schema = shape[key];
                const desc = schema.description || schema._def.innerType?.description || "";

                const prefix = key.length === 1 ? "-" : "--";
                lines.push({ flags: `${prefix}${key}`, desc });
            }

            // Print aligned
            const maxLen = Math.max(...lines.map(l => l.flags.length));
            for (const line of lines) {
                const padding = " ".repeat(maxLen - line.flags.length + 4);
                logger.log(`  ${line.flags}${padding}${line.desc}`);
            }
        } else {
            // Fallback for non-object schemas (rare/impossible for flags)
            logger.log("  -h, --help       Show help for a command");
            logger.log("  -v, --verbose    Show verbose output");
        }

        if (this.examples.length > 0) {
            logger.newline();
            logger.log("Examples:");
            for (const ex of this.examples) {
                logger.log(`  ${ex}`);
            }
        }
        logger.newline();

        return 0;
    }

    /**
     * Main execution entry point.
     * @param ctx The dependency injection context
     * @param args Validated positional arguments
     * @param flags Validated flags/options
     */
    abstract run(ctx: Context, args: z.infer<Args>, flags: z.infer<Flags>): Promise<number>;
}
