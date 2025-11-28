/**
 * Parallel worker search implementation.
 * Uses multi-worker parallel search for fast performance.
 */

import { listInstalledApps } from "src/lib/apps.ts";
import { findInstalledManifest } from "src/lib/manifests.ts";
import { parallelSearch } from "src/lib/search";
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

/**
 * Mark results with installation status
 */
function markInstalledApps(results: SearchResult[]): SearchResult[] {
    const installedApps = listInstalledApps();
    const installedMap = new Map<string, { bucket?: string; scope: string }>();

    for (const app of installedApps) {
        const manifest = findInstalledManifest(app.name);
        installedMap.set(app.name.toLowerCase(), {
            bucket: manifest?.bucket,
            scope: app.scope,
        });
    }

    return results.map(result => {
        const installed = installedMap.get(result.name.toLowerCase());
        return {
            ...result,
            isInstalled: !!installed,
            scope: installed?.scope === "global" ? ("global" as const) : result.scope,
        };
    });
}

/**
 * Search buckets using parallel workers
 */
export async function searchBuckets(
    query: string,
    options: {
        caseSensitive?: boolean;
        bucket?: string;
        installedOnly?: boolean;
    } = {},
    isVerbose: boolean = false,
    onProgress?: (completed: number, total: number, bucketName: string) => void
): Promise<SearchResult[]> {
    const startTime = performance.now();

    if (isVerbose) {
        verbose(`Starting parallel worker search for: "${query}"`);
    }

    const workerResults = await parallelSearch(
        query,
        {
            caseSensitive: options.caseSensitive,
            bucket: options.bucket,
        },
        onProgress
    );

    const searchTime = Math.round(performance.now() - startTime);

    if (isVerbose) {
        verbose(
            `Parallel search completed in ${searchTime}ms, found ${workerResults.length} matches`
        );
    }

    // Convert to SearchResult format
    let results: SearchResult[] = workerResults.map(r => ({
        name: r.name,
        version: r.version,
        bucket: r.bucket,
        scope: r.scope,
        description: r.description,
        binaries: r.binaries,
        isInstalled: false,
    }));

    // Mark installed apps
    const installedStartTime = performance.now();
    results = markInstalledApps(results);
    const installedTime = Math.round(performance.now() - installedStartTime);

    if (isVerbose) {
        verbose(`Marked installed apps in ${installedTime}ms`);
    }

    // Filter installed only
    if (options.installedOnly) {
        results = results.filter(r => r.isInstalled);
    }

    return results.slice(0, 100);
}

/**
 * Alias for backwards compatibility
 */
export const searchBucketsOptimized = searchBuckets;

/**
 * Format and display search results
 */
export function formatResults(results: SearchResult[], isVerbose: boolean): void {
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

            if (isVerbose && result.description) {
                log(`        ${dim(result.description)}`);
            }

            if (isVerbose && result.binaries && result.binaries.length > 0) {
                const binariesText = result.binaries.map(bin => green(bin.trim())).join("', '");
                log(`        ${dim("-->")} includes '${binariesText}'`);
            }
        }
    }

    log(`\n${blue(`Found ${results.length} package(s).`)}`);
}
