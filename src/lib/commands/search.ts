/**
 * SQLite-only search implementation using Scoop's built-in database.
 * Requires use_sqlite_cache to be enabled in Scoop configuration.
 */

import { listInstalledApps } from "src/lib/apps.ts";
import { findInstalledManifest } from "src/lib/manifests.ts";
import { ScoopSQLiteCache } from "src/lib/sqlite";
import { blue, bold, cyan, dim, green, yellow } from "src/utils/colors.ts";
import { error, log, verbose, warn } from "src/utils/logger.ts";

export interface SearchResult {
    name: string;
    version?: string;
    bucket: string;
    scope: "user" | "global";
    description?: string;
    binaries?: string[];
    isInstalled: boolean;
}

export async function searchBucketsOptimized(
    query: string,
    options: {
        caseSensitive?: boolean;
        bucket?: string;
        installedOnly?: boolean;
    },
    isVerbose: boolean = false
): Promise<SearchResult[]> {
    const searchStartTime = performance.now();

    if (isVerbose) {
        verbose(`Starting SQLite search for: "${query}"`);
        if (options.bucket) {
            verbose(`Searching in bucket: ${options.bucket}`);
        }
        if (options.installedOnly) {
            verbose(`Searching only installed packages`);
        }
        if (options.caseSensitive) {
            verbose(`Using case-sensitive search`);
        }
    }

    // Initialize SQLite cache - this is now required
    const sqliteCache = new ScoopSQLiteCache();

    try {
        await sqliteCache.initialize();

        if (isVerbose) {
            verbose("Using Scoop's SQLite cache for search");
        }

        const sqliteStartTime = performance.now();
        let sqliteResults = await sqliteCache.search(query);
        const sqliteTime = Math.round(performance.now() - sqliteStartTime);

        if (isVerbose) {
            verbose(
                `SQLite search completed in ${sqliteTime}ms, found ${sqliteResults.length} matches`
            );
        }

        // Apply bucket filter if specified
        if (options.bucket) {
            sqliteResults = sqliteResults.filter(
                result => result.bucket.toLowerCase() === options.bucket!.toLowerCase()
            );
        }

        // Get installed apps info for marking installation status
        const installedStartTime = performance.now();
        const installedApps = listInstalledApps();
        const installedMap = new Map<string, { bucket?: string; scope: string }>();

        for (const app of installedApps) {
            const manifest = findInstalledManifest(app.name);
            installedMap.set(app.name.toLowerCase(), {
                bucket: manifest?.bucket,
                scope: app.scope,
            });
        }

        const installedTime = Math.round(performance.now() - installedStartTime);
        if (isVerbose) {
            verbose(`Loaded ${installedApps.length} installed apps in ${installedTime}ms`);
        }

        // Update installation status and scope for results
        const results = sqliteResults
            .map(result => {
                const installed = installedMap.get(result.name.toLowerCase());
                return {
                    ...result,
                    isInstalled: !!installed,
                    scope: installed?.scope === "global" ? ("global" as const) : ("user" as const),
                };
            })
            .filter(result => {
                // Apply installed filter
                if (options.installedOnly && !result.isInstalled) {
                    return false;
                }
                return true;
            });

        const totalTime = Math.round(performance.now() - searchStartTime);
        if (isVerbose) {
            verbose(`Total SQLite search time: ${totalTime}ms`);
            verbose(`Breakdown - SQLite: ${sqliteTime}ms, Installed: ${installedTime}ms`);
        }

        // Clean up
        sqliteCache.close();

        // Limit results to prevent excessive output
        return results.slice(0, 100);
    } catch (initError) {
        sqliteCache.close();

        // Provide helpful error messages for common issues
        let errorMessage = `SQLite cache initialization failed: ${initError instanceof Error ? initError.message : String(initError)}`;

        if (errorMessage.includes("Scoop installation not found")) {
            errorMessage += "\n\nPlease install Scoop first: https://scoop.sh";
        } else if (errorMessage.includes("SQLite cache is disabled")) {
            errorMessage += "\n\nEnable SQLite cache with: scoop config use_sqlite_cache true";
            errorMessage += "\nThen run: scoop update";
        } else if (
            errorMessage.includes("database not found") ||
            errorMessage.includes("table is empty")
        ) {
            errorMessage += "\n\nRun: scoop update";
        }

        throw new Error(errorMessage);
    }
}

export async function searchBuckets(
    query: string,
    options: {
        caseSensitive?: boolean;
        bucket?: string;
        installedOnly?: boolean;
    },
    isVerbose: boolean = false
): Promise<SearchResult[]> {
    try {
        return await searchBucketsOptimized(query, options, isVerbose);
    } catch (searchError) {
        error(
            `Search failed: ${searchError instanceof Error ? searchError.message : String(searchError)}`
        );
        throw searchError;
    }
}

// Formatting functions for search results
export function formatResults(results: SearchResult[], verbose: boolean): void {
    if (results.length === 0) {
        warn("No packages found.");
        return;
    }

    // Group by bucket
    const bucketGroups = new Map<string, SearchResult[]>();
    for (const result of results) {
        if (!bucketGroups.has(result.bucket)) {
            bucketGroups.set(result.bucket, []);
        }
        bucketGroups.get(result.bucket)!.push(result);
    }

    // Sort buckets and display
    const sortedBuckets = Array.from(bucketGroups.entries()).sort(([a], [b]) => a.localeCompare(b));

    for (let i = 0; i < sortedBuckets.length; i++) {
        const [bucketName, bucketResults] = sortedBuckets[i];
        log(`${i === 0 ? "" : "\n"}${yellow(`'${bucketName}' bucket:`)}`);

        // Sort results within bucket (installed first, then alphabetical)
        bucketResults.sort((a, b) => {
            if (a.isInstalled !== b.isInstalled) {
                return a.isInstalled ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        for (const result of bucketResults) {
            let line = `    ${bold(cyan(result.name))}`;

            if (result.version) {
                line += ` ${dim(`(${green(result.version)})`)}`;
            }

            if (result.isInstalled) {
                line += ` ${green("[installed]")}`;
            }

            log(line);

            if (verbose && result.description) {
                log(`        ${dim(result.description)}`);
            }

            if (result.binaries && result.binaries.length > 0) {
                const binariesText = result.binaries.map(bin => green(bin)).join("', '");
                log(`        ${dim("-->")} includes '${binariesText}'`);
            }
        }
    }

    log(`\n${blue(`Found ${results.length} package(s).`)}`);
}
