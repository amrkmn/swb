import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { z } from "zod";
import { printInfo } from "./views";

const InfoArgs = z.object({
    app: z.string().min(1, "App name is required"),
});

const InfoFlags = z.object({
    verbose: z.boolean().default(false),
    v: z.boolean().default(false),
});

export class InfoCommand extends Command<typeof InfoArgs, typeof InfoFlags> {
    name = "info";
    description = "Show detailed info about an app";
    argsSchema = InfoArgs;
    flagsSchema = InfoFlags;

    async run(ctx: Context, args: z.infer<typeof InfoArgs>, flags: z.infer<typeof InfoFlags>) {
        const { logger, services } = ctx;
        const manifestService = services.manifests;
        const appName = args.app;
        const verbose = flags.verbose || flags.v;

        const results = manifestService.findAllManifests(appName);

        if (results.length === 0) {
            logger.error(`Could not find '${appName}' in installed apps or local buckets.`);
            logger.info(
                `\nTip: Try 'swb search ${appName}' to find similar apps or check if buckets are up to date.`
            );
            return 1;
        }

        // Show the primary result (prefer installed if available)
        const primary = results.find(r => r.source === "installed") || results[0];

        // Extract fields using the service helper
        const fields = manifestService.readManifestFields(appName, primary);

        await printInfo(logger, primary, fields, verbose);

        return 0;
    }
}
