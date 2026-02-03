import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { z } from "zod";
import { printInfo } from "./views";

const InfoArgs = z.object({
    app: z.string().min(1, "App name is required"),
});

const InfoFlags = z.object({});

export class InfoCommand extends Command<typeof InfoArgs, typeof InfoFlags> {
    name = "info";
    description = "Show detailed info about an app";
    argsSchema = InfoArgs;
    flagsSchema = InfoFlags;

    async run(ctx: Context, args: z.infer<typeof InfoArgs>, _flags: z.infer<typeof InfoFlags>) {
        const { logger, services } = ctx;
        const manifestService = services.manifests;
        const appName = args.app;

        const results = manifestService.findAllManifests(appName);

        if (results.length === 0) {
            logger.error(`Could not find '${appName}' in installed apps or local buckets.`);
            logger.info(
                `\nTip: Try 'swb search ${appName}' to find similar apps or check if buckets are up to date.`
            );
            return 1;
        }

        const { installed, bucket } = manifestService.findManifestPair(appName);
        const primary = installed || bucket;

        if (results.length > 1 && !installed) {
            logger.info(`Found '${appName}' in ${results.length} bucket(s):`);
            results.forEach((r, i) => {
                if (r.source === "bucket") {
                    logger.info(`  ${i + 1}. ${r.bucket} (version: ${r.manifest.version})`);
                }
            });
            logger.info(`\nShowing info from: ${primary?.bucket || "first result"}`);
        }

        const fields = manifestService.readManifestPair(appName, installed, bucket);

        if (!primary) {
            logger.error("No manifest found");
            return 1;
        }

        await printInfo(logger, primary, fields);

        return 0;
    }
}
