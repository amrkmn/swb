/**
 * Bucket update subcommand - Update installed buckets in parallel with animated progress
 */

import { bucketExists, getAllBuckets } from "src/lib/buckets.ts";
import type { ParsedArgs } from "src/lib/parser.ts";
import type { InstallScope } from "src/lib/paths.ts";
import type {
    BucketUpdateJob,
    BucketUpdateResponse,
    BucketUpdateResult,
} from "src/lib/workers/bucket-update.ts";
import { getWorkerUrl } from "src/lib/workers/index.ts";
import { cyan, dim, green, red, yellow } from "src/utils/colors.ts";
import { error, log, newline } from "src/utils/logger.ts";

interface BucketProgress {
    name: string;
    status: "pending" | "updating" | "updated" | "up-to-date" | "failed";
    message: string;
    commits?: string[];
}

let animationFrame = 0;

/**
 * Get animated dots for updating status
 */
function getAnimatedDots(): string {
    const dots = [".  ", ".. ", "..."];
    return dots[animationFrame % dots.length];
}

/**
 * Display multi-bucket progress (in-place update)
 */
function displayProgress(buckets: BucketProgress[], isInitial: boolean = false): void {
    if (!isInitial && buckets.length > 0) {
        // Move cursor up to overwrite previous progress
        // +2 for header and blank line
        process.stdout.write(`\x1b[${buckets.length + 2}A`);
    }

    // Clear and write header
    process.stdout.write("\rUpdating buckets:\x1b[K\n");
    process.stdout.write("\r\x1b[K\n");

    // Write each bucket line
    for (const bucket of buckets) {
        const paddedName = bucket.name.padEnd(20);
        let icon = "⏳";
        let statusColor = dim;
        let statusText = bucket.message;

        switch (bucket.status) {
            case "updating":
                icon = "🔄";
                statusColor = yellow;
                statusText = `Updating${getAnimatedDots()}`;
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

        // Clear line and write bucket status
        process.stdout.write(`\r${icon} ${cyan(paddedName)} ${statusColor(statusText)}\x1b[K\n`);
    }
}

/**
 * Update bucket(s) using parallel workers with animated progress
 */
export async function handler(args: ParsedArgs): Promise<number> {
    try {
        const scope: InstallScope = args.flags.global ? "global" : "user";
        const bucketName = args.args[0];
        const showChangelog = args.flags.changelog || false;

        let bucketsToUpdate: string[] = [];

        if (bucketName) {
            // Update specific bucket
            if (!bucketExists(bucketName, scope)) {
                error(`Bucket '${bucketName}' not found.`);
                return 1;
            }
            bucketsToUpdate = [bucketName];
        } else {
            // Update all buckets
            bucketsToUpdate = getAllBuckets(scope);

            if (bucketsToUpdate.length === 0) {
                log("No buckets installed.");
                return 0;
            }
        }

        // Initialize progress tracking
        const bucketProgress: BucketProgress[] = bucketsToUpdate.map(name => ({
            name,
            status: "pending" as const,
            message: "Waiting...",
        }));

        // Reset animation frame
        animationFrame = 0;

        // Display initial progress
        displayProgress(bucketProgress, true);

        // Use workers to update buckets in parallel
        const workerUrl = getWorkerUrl("bucket/update");
        const workers: Worker[] = [];
        const results: BucketUpdateResult[] = [];

        // Animate progress while updates are running
        const animationInterval = setInterval(() => {
            const hasUpdating = bucketProgress.some(b => b.status === "updating");
            if (hasUpdating) {
                animationFrame++;
                displayProgress(bucketProgress);
            }
        }, 300); // Update every 300ms

        // Create promise for each bucket
        const promises = bucketsToUpdate.map((name, index) => {
            return new Promise<BucketUpdateResult | null>((resolve, reject) => {
                const worker = new Worker(workerUrl);

                const job: BucketUpdateJob = { name, scope, showChangelog };

                // Mark as updating and display
                bucketProgress[index].status = "updating";
                bucketProgress[index].message = "Updating...";
                displayProgress(bucketProgress);

                worker.onmessage = (event: MessageEvent<BucketUpdateResponse>) => {
                    const response = event.data;

                    if (response.type === "result" && response.data) {
                        const result = response.data;

                        // Update progress
                        bucketProgress[index].status = result.status;
                        bucketProgress[index].commits = result.commits;

                        if (result.status === "failed") {
                            bucketProgress[index].message = result.error || "Unknown error";
                        }

                        // Display updated progress
                        displayProgress(bucketProgress);

                        resolve(result);
                    } else {
                        bucketProgress[index].status = "failed";
                        bucketProgress[index].message = "Unknown error";
                        displayProgress(bucketProgress);
                        resolve(null);
                    }

                    worker.terminate();
                };

                worker.onerror = err => {
                    bucketProgress[index].status = "failed";
                    bucketProgress[index].message = "Worker error";
                    displayProgress(bucketProgress);
                    worker.terminate();
                    resolve(null);
                };

                worker.postMessage(job);
                workers.push(worker);
            });
        });

        // Wait for all workers to complete
        const bucketResults = await Promise.all(promises);

        // Stop animation
        clearInterval(animationInterval);

        // Display final progress
        displayProgress(bucketProgress);

        // Filter out nulls and collect results
        for (const result of bucketResults) {
            if (result) {
                results.push(result);
            }
        }

        // Display changelog if requested
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

        // Display summary
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
    } catch (err) {
        error(`Failed to update buckets: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }
}

export const help = `
Usage: swb bucket update [name] [options]

Update installed bucket(s) by pulling latest changes from their remote repositories.
Updates run in parallel with individual progress for each bucket.

Arguments:
  name   Name of specific bucket to update (optional, updates all if omitted)

Options:
  --changelog   Show commit messages for updates
  --global      Update global buckets instead of user buckets

Examples:
  swb bucket update
  swb bucket update extras
  swb bucket update --changelog
  swb bucket update extras --global
`;
