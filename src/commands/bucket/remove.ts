import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { z } from "zod";

const RemoveArgs = z.object({
    name: z.string().min(1, "Bucket name is required"),
});

const RemoveFlags = z.object({
    global: z.boolean().default(false),
    force: z.boolean().default(false),
    f: z.boolean().default(false),
});

export class BucketRemoveCommand extends Command<typeof RemoveArgs, typeof RemoveFlags> {
    name = "remove";
    description = "Remove an installed bucket";
    aliases = ["rm"];
    argsSchema = RemoveArgs;
    flagsSchema = RemoveFlags;

    async run(ctx: Context, args: z.infer<typeof RemoveArgs>, flags: z.infer<typeof RemoveFlags>) {
        const { logger, services } = ctx;
        const bucketService = services.buckets;
        const scope = flags.global ? "global" : "user";
        const name = args.name;
        const force = flags.force || flags.f;

        // 1. Check existence
        if (!bucketService.exists(name, scope)) {
            logger.error(`Bucket '${name}' not found.`);
            return 1;
        }

        // 2. Warn main bucket
        if (name === "main") {
            logger.warn("Warning: Removing the 'main' bucket may break Scoop functionality!");
        }

        // 3. Confirm (Force only for now)
        if (!force) {
            // Interactive prompt not supported yet in v2
            logger.error("Use --force flag to confirm bucket removal:");
            logger.log(`  swb bucket remove ${name} --force`);
            return 1;
        }

        logger.log(`Removing bucket '${name}'...`);

        try {
            bucketService.remove(name, scope);
            logger.success(`Bucket '${name}' removed successfully.`);
            return 0;
        } catch (err) {
            logger.error(
                `Failed to remove bucket: ${err instanceof Error ? err.message : String(err)}`
            );
            return 1;
        }
    }
}
