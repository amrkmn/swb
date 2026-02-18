import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { cyan, dim, green, red, yellow } from "src/utils/colors";
import { error, log, newline } from "src/utils/logger";
import type { InstallScope } from "src/utils/paths";
import { z } from "zod";

const UpdateArgs = z.object({
    name: z.string().optional(),
});

const UpdateFlags = z.object({
    global: z.boolean().default(false),
    changelog: z.boolean().default(false),
});

interface BucketProgress {
    name: string;
    status: "pending" | "updating" | "updated" | "up-to-date" | "failed";
    message: string;
    commits?: string[];
}

export class BucketUpdateCommand extends Command<typeof UpdateArgs, typeof UpdateFlags> {
    name = "update";
    description = "Update installed bucket(s) by pulling latest changes";
    argsSchema = UpdateArgs;
    flagsSchema = UpdateFlags;

    private animationFrame = 0;

    async run(ctx: Context, args: z.infer<typeof UpdateArgs>, flags: z.infer<typeof UpdateFlags>) {
        const { services } = ctx;
        const bucketService = services.buckets;
        const workerService = services.workers;

        const scope: InstallScope = flags.global ? "global" : "user";
        const bucketName = args.name;
        const showChangelog = flags.changelog;

        let bucketsToUpdate: string[] = [];

        if (bucketName) {
            // Update specific bucket
            if (!bucketService.exists(bucketName, scope)) {
                error(`Bucket '${bucketName}' not found.`);
                return 1;
            }
            bucketsToUpdate = [bucketName];
        } else {
            // Update all buckets
            const buckets = await bucketService.list(scope);
            bucketsToUpdate = buckets.map(b => b.name);

            if (bucketsToUpdate.length === 0) {
                log("No buckets installed.");
                return 0;
            }
        }

        // Initialize progress tracking
        const bucketProgress: BucketProgress[] = bucketsToUpdate.map(name => ({
            name,
            status: "pending",
            message: "Waiting...",
        }));

        this.animationFrame = 0;
        this.displayProgress(bucketProgress, true);

        // Animate progress
        const animationInterval = setInterval(() => {
            const hasUpdating = bucketProgress.some(b => b.status === "updating");
            if (hasUpdating) {
                this.animationFrame++;
                this.displayProgress(bucketProgress);
            }
        }, 300);

        const results = await workerService.updateBuckets(bucketsToUpdate, scope, showChangelog, {
            onStart: (_, index) => {
                bucketProgress[index].status = "updating";
                bucketProgress[index].message = "Updating...";
                this.displayProgress(bucketProgress);
            },
            onComplete: (result, index) => {
                bucketProgress[index].status = result.status;
                bucketProgress[index].commits = result.commits;

                if (result.status === "failed") {
                    bucketProgress[index].message = result.error || "Unknown error";
                }

                this.displayProgress(bucketProgress);
            },
        });

        clearInterval(animationInterval);
        this.displayProgress(bucketProgress);

        // Display changelog
        if (showChangelog) {
            newline();
            log("Changelog:");
            newline();

            for (const progress of bucketProgress) {
                if (
                    progress.status === "updated" &&
                    progress.commits &&
                    progress.commits.length > 0
                ) {
                    log(`${cyan(progress.name)}:`);
                    for (const commit of progress.commits) {
                        log(`  - ${commit}`);
                    }
                    newline();
                }
            }
        }

        // Summary
        const updated = results.filter(r => r.status === "updated").length;
        const upToDate = results.filter(r => r.status === "up-to-date").length;
        const failed = results.filter(r => r.status === "failed").length;

        newline();
        log("Update summary:");
        log(`  Updated: ${green(updated.toString())}`);
        log(`  Up-to-date: ${dim(upToDate.toString())}`);
        if (failed > 0) {
            log(`  Failed: ${red(failed.toString())}`);
        }

        return failed > 0 ? 1 : 0;
    }

    private getAnimatedDots(): string {
        const dots = [".  ", ".. ", "..."];
        return dots[this.animationFrame % dots.length];
    }

    private displayProgress(buckets: BucketProgress[], isInitial: boolean = false): void {
        if (!isInitial && buckets.length > 0) {
            process.stdout.write(`\x1b[${buckets.length + 2}A`);
        }

        process.stdout.write("\rUpdating buckets:\x1b[K\n");
        process.stdout.write("\r\x1b[K\n");

        for (const bucket of buckets) {
            const paddedName = bucket.name.padEnd(20);
            let icon = "⏳";
            let statusColor = dim;
            let statusText = bucket.message;

            switch (bucket.status) {
                case "updating":
                    icon = "🔄";
                    statusColor = yellow;
                    statusText = `Updating${this.getAnimatedDots()}`;
                    break;
                case "updated":
                    icon = "✅";
                    statusColor = green;
                    statusText = "Updated";
                    break;
                case "up-to-date":
                    icon = "✅";
                    statusColor = dim;
                    statusText = "No updates available";
                    break;
                case "failed":
                    icon = "❌";
                    statusColor = red;
                    break;
            }

            process.stdout.write(
                `\r${icon} ${cyan(paddedName)} ${statusColor(statusText)}\x1b[K\n`
            );
        }
    }
}
