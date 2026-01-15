/**
 * Bucket list subcommand - Display installed buckets with metadata
 */

import type { ParsedArgs } from "src/lib/parser.ts";
import { error, log, newline } from "src/utils/logger.ts";
import { getAllBuckets } from "src/lib/buckets.ts";
import { getWorkerUrl } from "src/lib/workers/index.ts";
import type { InstallScope } from "src/lib/paths.ts";
import type {
    BucketInfoJob,
    BucketInfoResult,
    BucketInfoResponse,
} from "src/lib/workers/bucket-info.ts";
import { bold, cyan, dim, green } from "src/utils/colors.ts";
import { formatLineColumns } from "src/utils/helpers.ts";

/**
 * Format date to YYYY-MM-DD HH:MM:SS
 */
function formatDate(dateStr: string): string {
    if (dateStr === "unknown") return "";
    try {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch {
        return "";
    }
}

/**
 * Display buckets in table format
 */
function displayBucketsList(buckets: BucketInfoResult[]): void {
    if (buckets.length === 0) return;

    // Prepare table data with header
    const tableData: string[][] = [
        ["Name", "Source", "Updated", "Manifests"].map(h => bold(green(h))),
    ];

    for (const bucket of buckets) {
        const name = cyan(bucket.name);
        const source = bucket.source;
        const updated = formatDate(bucket.updated);
        const manifests = bucket.manifests.toString();

        tableData.push([name, source, updated, manifests]);
    }

    const formattedTable = formatLineColumns(tableData, {
        weights: [1.0, 3.0, 1.5, 0.5],
    });
    log(formattedTable);
}

/**
 * Display summary line
 */
function displayBucketsSummary(total: number): void {
    newline();
    log(dim(`${total} bucket${total !== 1 ? "s" : ""} installed`));
}

/**
 * List all installed buckets using parallel workers
 */
export async function handler(args: ParsedArgs): Promise<number> {
    try {
        const json = args.flags.json || args.flags.j || false;
        const scope: InstallScope = args.flags.global ? "global" : "user";

        const bucketNames = getAllBuckets(scope);

        if (bucketNames.length === 0) {
            if (json) {
                log("[]");
            } else {
                log("No buckets installed.");
            }
            return 0;
        }

        // Use workers to gather bucket info in parallel
        const workerUrl = getWorkerUrl("bucket-info");
        const workers: Worker[] = [];
        const results: BucketInfoResult[] = [];

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

        // Filter out nulls (failed buckets)
        for (const result of bucketResults) {
            if (result) {
                results.push(result);
            }
        }

        if (json) {
            const jsonOutput = results.map(bucket => ({
                name: bucket.name,
                source: bucket.source,
                updated: bucket.updated,
                manifests: bucket.manifests,
            }));
            log(JSON.stringify(jsonOutput, null, 2));
        } else {
            displayBucketsList(results);
            displayBucketsSummary(results.length);
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
  -j, --json    Output in JSON format
  --global      List global buckets instead of user buckets

Examples:
  swb bucket list
  swb bucket list --json
  swb bucket list --global
`;
