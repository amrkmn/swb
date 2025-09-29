/**
 * Optimized search implementation with persistent caching for fast cold starts.
 * This replaces the synchronous manifest reading with precomputed search indexes.
 */

import { listInstalledApps } from "src/lib/apps.ts";
import { searchCache, type PackageIndexEntry } from "src/lib/commands/cache.ts";
import { findInstalledManifest } from "src/lib/manifests.ts";
import { blue, bold, cyan, dim, green, yellow } from "src/utils/colors.ts";
import { log, verbose, warn } from "src/utils/logger.ts";

export interface SearchResult {
    name: string;
    version?: string;
    bucket: string;
    scope: "user" | "global";
    description?: string;
    binaries?: string[];
    isInstalled: boolean;
}

function packageIndexToSearchResult(
    entry: PackageIndexEntry,
    installedMap: Map<string, { bucket?: string; scope: string }>,
    matchedBinaries?: string[]
): SearchResult {
    const installedInfo = installedMap.get(entry.name.toLowerCase());
    const isInstalled =
        installedInfo &&
        (installedInfo.bucket === entry.bucket ||
            (!installedInfo.bucket && entry.bucket === "main")); // fallback for legacy installs

    return {
        name: entry.name,
        version: entry.version,
        bucket: entry.bucket,
        scope: entry.scope,
        description: entry.description,
        binaries: matchedBinaries,
        isInstalled: !!isInstalled,
    };
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
        verbose(`Starting optimized search for: "${query}"`);
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

    // Ensure cache is fresh (this is fast if cache is recent)
    const cacheStartTime = performance.now();
    await searchCache.ensureFreshCache();
    const cacheTime = Math.round(performance.now() - cacheStartTime);

    if (isVerbose) {
        verbose(`Cache validation completed in ${cacheTime}ms`);
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

    // Perform the search using cached index
    const searchIndexStartTime = performance.now();
    const indexResults = searchCache.search(query, options);
    const searchIndexTime = Math.round(performance.now() - searchIndexStartTime);

    if (isVerbose) {
        verbose(
            `Index search completed in ${searchIndexTime}ms, found ${indexResults.length} matches`
        );
    }

    // Convert index entries to search results and apply filters
    const results: SearchResult[] = [];
    const flags = options.caseSensitive ? "" : "i";
    const pattern = new RegExp(query, flags);

    for (const entry of indexResults) {
        // Check for binary matches to include in results
        const matchedBinaries: string[] = [];
        for (const binary of entry.binaries) {
            if (pattern.test(binary)) {
                matchedBinaries.push(binary);
            }
        }

        const result = packageIndexToSearchResult(
            entry,
            installedMap,
            matchedBinaries.length > 0 ? matchedBinaries : undefined
        );

        // Apply installed filter
        if (options.installedOnly && !result.isInstalled) {
            continue;
        }

        results.push(result);

        // Limit results to prevent excessive output
        if (results.length >= 100) {
            if (isVerbose) {
                verbose(`Reached result limit of 100 packages`);
            }
            break;
        }
    }

    const totalTime = Math.round(performance.now() - searchStartTime);
    if (isVerbose) {
        verbose(`Total optimized search time: ${totalTime}ms`);
        verbose(
            `Breakdown - Cache: ${cacheTime}ms, Installed: ${installedTime}ms, Index: ${searchIndexTime}ms`
        );
    }

    return results;
}

// Backward compatibility function - automatically chooses optimized version
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
    } catch (error) {
        if (isVerbose) {
            verbose(`Optimized search failed, falling back to original: ${error}`);
        }
        // If the optimized version fails, we would fall back to the original
        // For now, we'll just return empty results
        warn(`Search failed: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

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

// Cache management utilities
export async function updateSearchCache(force = false): Promise<void> {
    await searchCache.updateCache(force);
}

export function clearSearchCache(): void {
    searchCache.clearCache();
}
