import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { cyan, dim } from "src/utils/colors";
import { z } from "zod";

const UnusedArgs = z.object({});
const UnusedFlags = z.object({
    json: z.boolean().default(false).optional(),
    j: z.boolean().default(false).optional(),
    global: z.boolean().default(false).optional(),
});

export class BucketUnusedCommand extends Command<typeof UnusedArgs, typeof UnusedFlags> {
    name = "unused";
    description = "Find buckets that have no packages installed from them";
    argsSchema = UnusedArgs;
    flagsSchema = UnusedFlags;

    async run(ctx: Context, _args: any, flags: z.infer<typeof UnusedFlags>) {
        const { logger, services } = ctx;
        const appsService = services.apps;
        const bucketService = services.buckets;

        const scope = flags.global ? "global" : "user";
        const json = flags.json || flags.j;

        // 1. Get all buckets
        const allBuckets = await bucketService.list(scope);

        if (allBuckets.length === 0) {
            if (json) {
                logger.log("[]");
            } else {
                logger.log("No buckets installed.");
            }
            return 0;
        }

        // 2. Get used buckets from installed apps
        const installedApps = appsService.listInstalled();
        const usedBuckets = new Set<string>();

        for (const app of installedApps) {
            if (app.scope === scope && app.bucket) {
                usedBuckets.add(app.bucket.toLowerCase());
            }
        }

        // 3. Filter unused
        const unusedBuckets = allBuckets.filter(b => !usedBuckets.has(b.name.toLowerCase()));

        // 4. Output
        if (json) {
            logger.log(
                JSON.stringify(
                    unusedBuckets.map(b => b.name),
                    null,
                    2
                )
            );
            return 0;
        }

        if (unusedBuckets.length === 0) {
            logger.log("No unused buckets");
            return 0;
        }

        logger.log("The following buckets are unused:");
        for (const bucket of unusedBuckets) {
            logger.log(`  ${cyan(bucket.name)}`);
        }

        logger.newline();
        logger.log(
            dim(`${unusedBuckets.length} unused bucket${unusedBuckets.length !== 1 ? "s" : ""}`)
        );

        return 0;
    }
}
