/**
 * Bucket list subcommand - Display installed buckets with metadata
 */

import type { ParsedArgs } from "src/lib/parser.ts";
import { error, log } from "src/utils/logger.ts";
import { getAllBuckets, getBucketPath, getBucketManifestCount } from "src/lib/buckets.ts";
import { getRemoteUrl, getLastCommitDate } from "src/lib/git.ts";
import type { InstallScope } from "src/lib/paths.ts";

interface BucketInfo {
    name: string;
    source: string;
    updated: string;
    manifests: number;
}

/**
 * List all installed buckets
 */
export async function handler(args: ParsedArgs): Promise<number> {
    try {
        const json = args.flags.json || false;
        const scope: InstallScope = args.global.global ? "global" : "user";

        const bucketNames = getAllBuckets(scope);

        if (bucketNames.length === 0) {
            if (!json) {
                log("No buckets installed.");
            } else {
                console.log(JSON.stringify([]));
            }
            return 0;
        }

        const buckets: BucketInfo[] = [];

        for (const name of bucketNames) {
            const bucketPath = getBucketPath(name, scope);
            const source = (await getRemoteUrl(bucketPath)) || "unknown";
            const lastCommit = await getLastCommitDate(bucketPath);
            const updated = lastCommit ? lastCommit.toISOString().split("T")[0] : "unknown";
            const manifests = getBucketManifestCount(bucketPath);

            buckets.push({
                name,
                source,
                updated,
                manifests,
            });
        }

        if (json) {
            console.log(JSON.stringify(buckets, null, 2));
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
            for (const bucket of buckets) {
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
