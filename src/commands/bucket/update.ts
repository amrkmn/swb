/**
 * Bucket update subcommand - Update installed buckets
 */

import type { ParsedArgs } from "src/lib/parser.ts";
import { error, log, success } from "src/utils/logger.ts";
import { getAllBuckets, getBucketPath, bucketExists } from "src/lib/buckets.ts";
import { pull, isGitRepo, getCommitsSinceRemote } from "src/lib/git.ts";
import { Loading } from "src/utils/loader.ts";
import type { InstallScope } from "src/lib/paths.ts";

/**
 * Update bucket(s)
 */
export async function handler(args: ParsedArgs): Promise<number> {
    try {
        const scope: InstallScope = args.global.global ? "global" : "user";
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

        let updated = 0;
        let upToDate = 0;
        let failed = 0;

        for (const name of bucketsToUpdate) {
            const bucketPath = getBucketPath(name, scope);

            // Check if it's a git repository
            if (!(await isGitRepo(bucketPath))) {
                error(`Bucket '${name}' is not a git repository. Skipping.`);
                failed++;
                continue;
            }

            const loader = new Loading(`Updating '${name}'`);
            loader.start();

            try {
                // Get commits before pulling
                const commitsBefore = showChangelog ? await getCommitsSinceRemote(bucketPath) : [];

                // Pull updates
                await pull(bucketPath);

                loader.stop();

                if (commitsBefore.length > 0) {
                    success(`✓ Updated '${name}'`);
                    if (showChangelog) {
                        log("  Changes:");
                        for (const commit of commitsBefore) {
                            log(`    - ${commit}`);
                        }
                    }
                    updated++;
                } else {
                    log(`  '${name}' is already up-to-date`);
                    upToDate++;
                }
            } catch (err) {
                loader.stop();
                error(
                    `✗ Failed to update '${name}': ${err instanceof Error ? err.message : String(err)}`
                );
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
