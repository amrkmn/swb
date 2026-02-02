import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { ProgressBar } from "src/utils/loader";
import { z } from "zod";

const AddArgs = z.object({
    name: z.string().min(1, "Bucket name is required"),
    url: z.url("Invalid repository URL").optional(),
});

const AddFlags = z.object({
    global: z.boolean().default(false),
});

export class BucketAddCommand extends Command<typeof AddArgs, typeof AddFlags> {
    name = "add";
    description = "Add a new bucket";
    argsSchema = AddArgs;
    flagsSchema = AddFlags;

    async run(ctx: Context, args: z.infer<typeof AddArgs>, flags: z.infer<typeof AddFlags>) {
        const { logger, services } = ctx;
        const bucketService = services.buckets;
        const scope = flags.global ? "global" : "user";
        const name = args.name;

        // 1. Validate name
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            logger.error(`Invalid bucket name: '${name}'`);
            logger.log("Bucket names can only contain letters, numbers, hyphens, and underscores.");
            return 1;
        }

        // 2. Check existence
        if (bucketService.exists(name, scope)) {
            logger.error(`Bucket '${name}' already exists.`);
            return 1;
        }

        // 3. Resolve URL
        let url = args.url;
        if (!url) {
            const knownUrl = bucketService.getKnownUrl(name);
            if (!knownUrl) {
                logger.error(`Bucket '${name}' is not a known bucket.`);
                logger.log("Please provide a repository URL:");
                logger.log(`  swb bucket add ${name} <repository-url>`);
                logger.newline();
                logger.log("To see known buckets, run:");
                logger.log("  swb bucket known");
                return 1;
            }
            url = knownUrl;
        }

        // 4. Validate URL (basic)
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            logger.error(`Invalid repository URL: '${url}'`);
            logger.log("URL must start with http:// or https://");
            return 1;
        }

        logger.log(`Adding bucket '${name}'...`);
        logger.log(`Source: ${url}`);
        logger.newline();

        // 5. Clone with progress
        const progressBar = new ProgressBar(100, `Cloning ${name}`);
        progressBar.start();

        try {
            await bucketService.add(name, url, scope, p => {
                progressBar.setProgress(p);
            });
            progressBar.complete();
        } catch (err) {
            progressBar.stop();
            logger.error(
                `Failed to clone bucket: ${err instanceof Error ? err.message : String(err)}`
            );
            return 1;
        }

        logger.newline();
        logger.success(`Bucket '${name}' added successfully.`);
        // We could fetch the actual count, but for now we skip it to keep it simple,
        // or we can add getManifestCount(name) to service.

        return 0;
    }
}
