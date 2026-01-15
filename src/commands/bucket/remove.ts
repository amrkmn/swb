/**
 * Bucket remove subcommand - Remove an installed bucket
 */

import type { ParsedArgs } from "src/lib/parser.ts";
import { error, log, warn, success } from "src/utils/logger.ts";
import { bucketExists, getBucketPath } from "src/lib/buckets.ts";
import type { InstallScope } from "src/lib/paths.ts";
import { rmSync } from "node:fs";

/**
 * Remove a bucket
 */
export async function handler(args: ParsedArgs): Promise<number> {
    try {
        const scope: InstallScope = args.global.global ? "global" : "user";
        const bucketName = args.args[0];
        const force = args.flags.force || args.flags.f || false;

        if (!bucketName) {
            error("Bucket name is required.");
            log(help);
            return 1;
        }

        // Check if bucket exists
        if (!bucketExists(bucketName, scope)) {
            error(`Bucket '${bucketName}' not found.`);
            return 1;
        }

        // Warn if removing main bucket
        if (bucketName === "main") {
            warn("Warning: Removing the 'main' bucket may break Scoop functionality!");
        }

        // Confirm removal unless force flag is set
        if (!force) {
            log(`Are you sure you want to remove bucket '${bucketName}'? (y/N)`);

            // Simple confirmation (in real implementation, you'd want to read from stdin)
            // For now, we'll require the --force flag
            error("Use --force flag to confirm bucket removal:");
            log(`  swb bucket remove ${bucketName} --force`);
            return 1;
        }

        const bucketPath = getBucketPath(bucketName, scope);

        log(`Removing bucket '${bucketName}'...`);

        try {
            rmSync(bucketPath, { recursive: true, force: true });
        } catch (err) {
            error(`Failed to remove bucket: ${err instanceof Error ? err.message : String(err)}`);
            return 1;
        }

        success(`Bucket '${bucketName}' removed successfully.`);

        return 0;
    } catch (err) {
        error(`Failed to remove bucket: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }
}

export const help = `
Usage: swb bucket remove <name> [options]

Remove an installed bucket.

Aliases: rm

Arguments:
  name    Name of the bucket to remove

Options:
  --force, -f   Skip confirmation prompt
  --global      Remove from global buckets instead of user buckets

Examples:
  swb bucket remove extras --force
  swb bucket rm my-bucket -f
  swb bucket remove extras --global --force
`;
