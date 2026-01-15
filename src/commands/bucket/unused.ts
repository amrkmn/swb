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

            // Check install.json for bucket information
            const installPath = path.join(appsDir, app, "current", "install.json");

            if (existsSync(installPath)) {
                try {
                    const installContent = Bun.file(installPath);
                    const installData = await installContent.json();

                    // Extract bucket from install.json
                    if (installData.bucket) {
                        buckets.add(installData.bucket);
                    }
                } catch {
                    // Skip if install.json is invalid
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
    const scope: InstallScope = args.flags.global ? "global" : "user";
    const json = args.flags.json || args.flags.j || false;

    const allBuckets = getAllBuckets(scope);

    if (allBuckets.length === 0) {
        if (!json) {
            log("No buckets installed.");
        } else {
            log(JSON.stringify([]));
        }
        return 0;
    }

    const usedBuckets = await getInstalledAppBuckets(scope);
    const unusedBuckets = allBuckets.filter(bucket => !usedBuckets.has(bucket));

    if (json) {
        log(JSON.stringify(unusedBuckets, null, 2));
        return 0;
    }

    if (unusedBuckets.length === 0) {
        log("No unused buckets");
        return 0;
    }

    log("The following buckets are unused:");
    for (const bucket of unusedBuckets) {
        log(`  ${bucket}`);
    }

    return 0;
}

export const help = `
Usage: swb bucket unused [options]

Find buckets that have no packages installed from them.

Options:
  -j, --json    Output in JSON format
  --global      Check global buckets instead of user buckets

Examples:
  swb bucket unused
  swb bucket unused --json
  swb bucket unused --global
`;
