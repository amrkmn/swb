/**
 * Bucket add subcommand - Add a new bucket repository
 */

import { getKnownBucket } from "src/utils/known-buckets.ts";
import { bucketExists, getBucketManifestCount, getBucketPath } from "src/lib/buckets.ts";
import { clone } from "src/lib/git.ts";
import type { ParsedArgs } from "src/lib/parser.ts";
import type { InstallScope } from "src/lib/paths.ts";
import { ProgressBar } from "src/utils/loader.ts";
import { error, log, success } from "src/utils/logger.ts";

/**
 * Add a new bucket
 */
export async function handler(args: ParsedArgs): Promise<number> {
    try {
        const scope: InstallScope = args.global.global ? "global" : "user";
        const bucketName = args.args[0];
        const repoUrl = args.args[1];

        if (!bucketName) {
            error("Bucket name is required.");
            log(help);
            return 1;
        }

        // Validate bucket name (alphanumeric, hyphens, underscores)
        if (!/^[a-zA-Z0-9_-]+$/.test(bucketName)) {
            error(`Invalid bucket name: '${bucketName}'`);
            log("Bucket names can only contain letters, numbers, hyphens, and underscores.");
            return 1;
        }

        // Check if bucket already exists
        if (bucketExists(bucketName, scope)) {
            error(`Bucket '${bucketName}' already exists.`);
            return 1;
        }

        // Resolve repository URL
        let url = repoUrl;
        if (!url) {
            // Look up in known buckets
            const knownUrl = getKnownBucket(bucketName);
            if (!knownUrl) {
                error(`Bucket '${bucketName}' is not a known bucket.`);
                log("Please provide a repository URL:");
                log(`  swb bucket add ${bucketName} <repository-url>`);
                log("");
                log("To see known buckets, run:");
                log("  swb bucket known");
                return 1;
            }
            url = knownUrl;
        }

        // Validate URL format (basic check)
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            error(`Invalid repository URL: '${url}'`);
            log("URL must start with http:// or https://");
            return 1;
        }

        const bucketPath = getBucketPath(bucketName, scope);

        log(`Adding bucket '${bucketName}'...`);
        log(`Source: ${url}`);
        log("");

        // Clone with progress bar
        const progress = new ProgressBar(100, `Cloning ${bucketName}`);
        progress.start();

        try {
            await clone(url, bucketPath, { progress });
            progress.complete();
        } catch (err) {
            progress.stop();
            error(`Failed to clone bucket: ${err instanceof Error ? err.message : String(err)}`);
            return 1;
        }

        // Get manifest count
        const manifestCount = getBucketManifestCount(bucketPath);

        log("");
        success(`Bucket '${bucketName}' added successfully.`);
        log(`Manifests available: ${manifestCount}`);

        return 0;
    } catch (err) {
        error(`Failed to add bucket: ${err instanceof Error ? err.message : String(err)}`);
        return 1;
    }
}

export const help = `
Usage: swb bucket add <name> [repository-url]

Add a new bucket to Scoop.

Arguments:
  name              Name of the bucket to add
  repository-url    Git repository URL (optional for known buckets)

Options:
  --global   Add to global buckets instead of user buckets

Examples:
  swb bucket add extras
  swb bucket add my-bucket https://github.com/user/my-bucket
  swb bucket add extras --global
`;
