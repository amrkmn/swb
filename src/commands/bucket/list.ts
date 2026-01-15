/**
 * Bucket list subcommand - Display installed buckets with metadata
 */

import type { ParsedArgs } from "src/lib/parser.ts";
import { error, log } from "src/utils/logger.ts";
import { getAllBuckets } from "src/lib/buckets.ts";
import { getWorkerUrl } from "src/lib/workers/index.ts";
import type { InstallScope } from "src/lib/paths.ts";
import type {
    BucketInfoJob,
    BucketInfoResult,
    BucketInfoResponse,
} from "src/lib/workers/bucket-info.ts";

/**
 * List all installed buckets using parallel workers
 */
export async function handler(args: ParsedArgs): Promise<number> {
    try {
        const json = args.flags.json || false;
        const scope: InstallScope = args.flags.global ? "global" : "user";

        const bucketNames = getAllBuckets(scope);

        if (bucketNames.length === 0) {
            if (!json) {
                log("No buckets installed.");
            } else {
                console.log(JSON.stringify([]));
            }
            return 0;
        }

        // Use workers to gather bucket info in parallel
        const workerUrl = getWorkerUrl("bucket-info");
        const workers: Worker[] = [];
        const results: BucketInfoResult[] = [];
        let completed = 0;

        // Create promise for each bucket
        const promises = bucketNames.map(name => {
            return new Promise<BucketInfoResult | null>((resolve, reject) => {
                const worker = new Worker(workerUrl);

                const job: BucketInfoJob = { name, scope };

                worker.onmessage = (event: MessageEvent<BucketInfoResponse>) => {
                    const response = event.data;

                    if (response.type === "result" && response.data) {
                        resolve(response.data);
                    } else {
                        // Skip buckets with errors
                        resolve(null);
                    }

                    worker.terminate();
                    completed++;
                };

                worker.onerror = err => {
                    worker.terminate();
                    completed++;
                    resolve(null);
                };

                worker.postMessage(job);
                workers.push(worker);
            });
        });

        // Wait for all workers to complete
        const bucketResults = await Promise.all(promises);

        // Filter out nulls (failed buckets)
        for (const result of bucketResults) {
            if (result) {
                results.push(result);
            }
        }

        if (json) {
            console.log(JSON.stringify(results, null, 2));
        } else {
            // Display as table
            log("");
            log("Installed buckets:");
            log("");

            // Header
            const nameCol = "Name".padEnd(20);
            const sourceCol = "Source".padEnd(50);
            const updatedCol = "Updated".padEnd(12);
            const manifestsCol = "Manifests";

            log(`  ${nameCol} ${sourceCol} ${updatedCol} ${manifestsCol}`);
            log(`  ${"─".repeat(20)} ${"─".repeat(50)} ${"─".repeat(12)} ${"─".repeat(10)}`);

            // Rows
            for (const bucket of results) {
                const name = bucket.name.padEnd(20);
                const source = bucket.source.padEnd(50);
                const updated = bucket.updated.padEnd(12);
                const manifests = bucket.manifests.toString();

                log(`  ${name} ${source} ${updated} ${manifests}`);
            }

            log("");
        }

        return 0;
    } catch (err) {
        error(`Failed to list buckets: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }
}

export const help = `
Usage: swb bucket list [options]

List all installed buckets with their metadata.

Options:
  --json     Output in JSON format
  --global   List global buckets instead of user buckets

Examples:
  swb bucket list
  swb bucket list --json
  swb bucket list --global
`;
