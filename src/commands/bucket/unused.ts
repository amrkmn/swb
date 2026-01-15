/**
 * Bucket unused subcommand - Find buckets without installed packages
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { getAllBuckets } from "src/lib/buckets.ts";
import type { ParsedArgs } from "src/lib/parser.ts";
import { resolveScoopPaths, type InstallScope } from "src/lib/paths.ts";
import { log } from "src/utils/logger.ts";

/**
 * Get all installed apps and their bucket source
 */
async function getInstalledAppBuckets(scope: InstallScope): Promise<Set<string>> {
    const buckets = new Set<string>();
    const paths = resolveScoopPaths(scope);
    const appsDir = paths.apps;

    if (!existsSync(appsDir)) {
        return buckets;
    }

    try {
        const apps = readdirSync(appsDir);

        for (const app of apps) {
            // Skip current/scoop meta directories
            if (app === "scoop" || app === "current") continue;

            const manifestPath = path.join(appsDir, app, "current", "manifest.json");

            if (existsSync(manifestPath)) {
                try {
                    const manifestContent = Bun.file(manifestPath);
                    const manifest = await manifestContent.json();

                    // Extract bucket from manifest metadata
                    if (manifest.bucket) {
                        buckets.add(manifest.bucket);
                    }
                } catch {
                    // Skip if manifest is invalid
                    continue;
                }
            }
        }
    } catch {
        // Return empty set if apps directory can't be read
    }

    return buckets;
}

/**
 * Find unused buckets
 */
export async function handler(args: ParsedArgs): Promise<number> {
    const scope: InstallScope = args.global.global ? "global" : "user";
    const json = args.flags.json || false;

    const allBuckets = getAllBuckets(scope);

    if (allBuckets.length === 0) {
        if (!json) {
            log("No buckets installed.");
        } else {
            console.log(JSON.stringify([]));
        }
        return 0;
    }

    const usedBuckets = await getInstalledAppBuckets(scope);
    const unusedBuckets = allBuckets.filter(bucket => !usedBuckets.has(bucket));

    if (json) {
        console.log(JSON.stringify(unusedBuckets, null, 2));
        return 0;
    }

    if (unusedBuckets.length === 0) {
        log("All buckets are in use.");
        return 0;
    }

    log("");
    log("Unused buckets:");
    log("");

    for (const bucket of unusedBuckets) {
        log(`  ${bucket}`);
    }

    log("");
    log(`Found ${unusedBuckets.length} unused bucket(s).`);
    log("");
    log("To remove a bucket:");
    log("  swb bucket remove <name> --force");
    log("");

    return 0;
}

export const help = `
Usage: swb bucket unused [options]

Find buckets that have no packages installed from them.

Options:
  --json     Output in JSON format
  --global   Check global buckets instead of user buckets

Examples:
  swb bucket unused
  swb bucket unused --json
  swb bucket unused --global
`;
