/**
 * Bucket update subcommand - Update installed buckets in parallel
 */

import type { ParsedArgs } from "src/lib/parser.ts";
import { error, log, success } from "src/utils/logger.ts";
import { getAllBuckets, bucketExists } from "src/lib/buckets.ts";
import { getWorkerUrl } from "src/lib/workers/index.ts";
import type { InstallScope } from "src/lib/paths.ts";
import type {
    BucketUpdateJob,
    BucketUpdateResult,
    BucketUpdateResponse,
} from "src/lib/workers/bucket-update.ts";
import { Loading } from "src/utils/loader.ts";

/**
 * Update bucket(s) using parallel workers
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

        log(`Updating ${bucketsToUpdate.length} bucket(s)...`);
        log("");

        // Use workers to update buckets in parallel
        const workerUrl = getWorkerUrl("bucket-update");
        const workers: Worker[] = [];
        const results: BucketUpdateResult[] = [];

        // Show loading spinner while updates are in progress
        const loader = new Loading("Updating buckets");
        loader.start();

        // Create promise for each bucket
        const promises = bucketsToUpdate.map(name => {
            return new Promise<BucketUpdateResult | null>((resolve, reject) => {
                const worker = new Worker(workerUrl);

                const job: BucketUpdateJob = { name, scope, showChangelog };

                worker.onmessage = (event: MessageEvent<BucketUpdateResponse>) => {
                    const response = event.data;

                    if (response.type === "result" && response.data) {
                        resolve(response.data);
                    } else {
                        resolve(null);
                    }

                    worker.terminate();
                };

                worker.onerror = err => {
                    worker.terminate();
                    resolve(null);
                };

                worker.postMessage(job);
                workers.push(worker);
            });
        });

        // Wait for all workers to complete
        const bucketResults = await Promise.all(promises);

        loader.stop();

        // Filter out nulls and collect results
        for (const result of bucketResults) {
            if (result) {
                results.push(result);
            }
        }

        // Display results
        let updated = 0;
        let upToDate = 0;
        let failed = 0;

        for (const result of results) {
            if (result.status === "updated") {
                success(`✓ Updated '${result.name}'`);
                if (showChangelog && result.commits && result.commits.length > 0) {
                    log("  Changes:");
                    for (const commit of result.commits) {
                        log(`    - ${commit}`);
                    }
                }
                updated++;
            } else if (result.status === "up-to-date") {
                log(`  '${result.name}' is already up-to-date`);
                upToDate++;
            } else if (result.status === "failed") {
                error(`✗ Failed to update '${result.name}': ${result.error || "Unknown error"}`);
                failed++;
            }
        }

        log("");
        log("Update summary:");
        log(`  Updated: ${updated}`);
        log(`  Up-to-date: ${upToDate}`);
        if (failed > 0) {
            log(`  Failed: ${failed}`);
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
Updates run in parallel for improved performance.

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
