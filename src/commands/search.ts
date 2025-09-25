import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, basename } from "path";
import { listInstalledApps } from "../lib/apps.ts";
import { findAllBucketsInScope } from "../lib/manifests.ts";
import type { CommandDefinition, ParsedArgs } from "../lib/parser.ts";

// Search result interface
import { error, log, warn } from "src/utils/logger.ts";
import { blue, bold, cyan, dim, green, yellow } from "../utils/colors.ts";

interface SearchResult {
    name: string;
    version?: string;
    bucket: string;
    scope: "user" | "global";
    description?: string;
    binaries?: string[];
    isInstalled: boolean;
}

// Optimized binary search - only parse manifest if name doesn't match
function searchInBinaries(manifestContent: string, pattern: RegExp): string[] {
    const matches: string[] = [];

    try {
        const manifest = JSON.parse(manifestContent);
        if (!manifest.bin) return matches;

        const bins = Array.isArray(manifest.bin) ? manifest.bin : [manifest.bin];

        for (const bin of bins) {
            if (typeof bin === "string") {
                const filename = bin.split(/[/\\]/).pop() || bin;
                const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
                if (pattern.test(filename) || pattern.test(nameWithoutExt)) {
                    matches.push(nameWithoutExt);
                }
            } else if (Array.isArray(bin) && bin.length > 1) {
                // Format: ["path/to/executable.exe", "alias"]
                const filename = bin[0].split(/[/\\]/).pop() || bin[0];
                const alias = bin[1];
                const nameWithoutExt = filename.replace(/\.[^.]+$/, "");

                if (pattern.test(filename) || pattern.test(nameWithoutExt) || pattern.test(alias)) {
                    matches.push(alias);
                }
            }
        }
    } catch {
        // Skip on parse error
    }

    return matches;
}

// Optimized search through all available manifests in buckets
async function searchBuckets(
    query: string,
    options: {
        caseSensitive?: boolean;
        bucket?: string;
        installedOnly?: boolean;
    }
): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const flags = options.caseSensitive ? "" : "i";
    const pattern = new RegExp(query, flags);

    // Start cache preloading in background if not already started
    if (!preloadStarted) {
        preloadStarted = true;
        startBucketCachePreloading(); // Don't await - let it run in background
    }

    // Get list of installed apps for checking installation status - cache this
    const installedApps = listInstalledApps();
    const installedSet = new Set(installedApps.map(app => app.name.toLowerCase()));

    const scopes: ("user" | "global")[] = ["user", "global"];
    const seenPackages = new Set<string>(); // Avoid duplicates across scopes

    // Early termination for exact matches - if we find exact matches quickly, we can stop
    const exactMatches = new Set<string>();
    const isSimpleQuery = query.length > 1 && !/[.*+?^${}()|[\]\\]/.test(query);

    for (const scope of scopes) {
        const buckets = findAllBucketsInScope(scope);

        for (const bucketInfo of buckets) {
            // Skip if specific bucket requested and this isn't it
            if (options.bucket && bucketInfo.name !== options.bucket) {
                continue;
            }

            try {
                if (!existsSync(bucketInfo.bucketDir)) continue;

                // Try to get cached contents first
                let bucketContents = getCachedBucketContents(bucketInfo.bucketDir);
                
                // If not cached, check if preloading is in progress and wait briefly
                if (!bucketContents && cachePreloadingPromise) {
                    try {
                        // Wait up to 100ms for preloading to complete this bucket
                        await Promise.race([
                            cachePreloadingPromise,
                            new Promise(resolve => setTimeout(resolve, 100))
                        ]);
                        bucketContents = getCachedBucketContents(bucketInfo.bucketDir);
                    } catch {
                        // Continue if preloading fails
                    }
                }
                
                // If still not cached, build cache synchronously with progress
                if (!bucketContents) {
                    bucketContents = buildBucketCacheOptimized(bucketInfo.bucketDir, true);
                }
                
                if (!bucketContents) continue;

                // Sort packages to prioritize exact matches first
                const packages = Object.keys(bucketContents);
                if (isSimpleQuery) {
                    packages.sort((a, b) => {
                        const aExact = a.toLowerCase() === query.toLowerCase();
                        const bExact = b.toLowerCase() === query.toLowerCase();
                        if (aExact && !bExact) return -1;
                        if (!aExact && bExact) return 1;
                        return 0;
                    });
                }

                for (const appName of packages) {
                    const packageKey = `${bucketInfo.name}:${appName}`;

                    // Skip duplicates across scopes
                    if (seenPackages.has(packageKey)) continue;

                    const isInstalled = installedSet.has(appName.toLowerCase());

                    // Early exit: Skip if installed-only filter is set and app is not installed
                    if (options.installedOnly && !isInstalled) {
                        continue;
                    }

                    const packageData = bucketContents[appName];
                    
                    // Quick name check first - if it matches, we're done for this package
                    if (pattern.test(appName)) {
                        seenPackages.add(packageKey);

                        // Mark as exact match for potential early termination
                        if (isSimpleQuery && appName.toLowerCase() === query.toLowerCase()) {
                            exactMatches.add(appName.toLowerCase());
                        }

                        results.push({
                            name: appName,
                            version: packageData.version,
                            bucket: bucketInfo.name,
                            scope,
                            description: packageData.description,
                            binaries: undefined,
                            isInstalled,
                        });

                        // Early termination: if we found exact matches and have reasonable results, stop searching
                        if (false) { // Disabled aggressive early termination
                            return results;
                        }

                        continue; // Skip binary search for this package
                    }

                    // Name doesn't match - check binaries only for simple queries
                    if (isSimpleQuery && query.length > 2 && packageData.binaries) {
                        const binaryMatches = packageData.binaries.filter(binary => pattern.test(binary));
                        
                        if (binaryMatches.length > 0) {
                            seenPackages.add(packageKey);
                            results.push({
                                name: appName,
                                version: packageData.version,
                                bucket: bucketInfo.name,
                                scope,
                                description: packageData.description,
                                binaries: binaryMatches,
                                isInstalled,
                            });
                        }
                    }

                    // Limit results to prevent excessive processing
                    if (results.length >= 100) {
                        return results;
                    }
                }
            } catch (error) {
                // Skip bucket on error and continue
                continue;
            }
        }
    }

    return results;
}

// Format search results for display
function formatResults(results: SearchResult[], verbose: boolean): void {
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

// New style command definition
// Bucket contents cache system for dramatically improved performance
interface CachedPackageData {
    version?: string;
    description?: string;
    binaries?: string[];
}

interface BucketCache {
    contents: Record<string, CachedPackageData>;
    timestamp: number;
    bucketPath: string;
}

const bucketCaches = new Map<string, BucketCache>();
const BUCKET_CACHE_TTL_MS = 300000; // 5 minutes cache for bucket contents

function getCachedBucketContents(bucketDir: string): Record<string, CachedPackageData> | null {
    const cached = bucketCaches.get(bucketDir);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > BUCKET_CACHE_TTL_MS) {
        bucketCaches.delete(bucketDir);
        return null;
    }

    return cached.contents;
}

function buildBucketCache(bucketDir: string): Record<string, CachedPackageData> | null {
    return buildBucketCacheOptimized(bucketDir, false);
}

// Function to clear stale caches
function clearStaleBucketCaches(): void {
    const now = Date.now();
    for (const [bucketDir, cache] of bucketCaches.entries()) {
        if (now - cache.timestamp > BUCKET_CACHE_TTL_MS) {
            bucketCaches.delete(bucketDir);
        }
    }
}

// Background cache preloader to eliminate first-search delay
let cachePreloadingPromise: Promise<void> | null = null;
let preloadStarted = false;

function startBucketCachePreloading(): Promise<void> {
    if (cachePreloadingPromise) return cachePreloadingPromise;
    
    cachePreloadingPromise = (async () => {
        try {
            const scopes: ("user" | "global")[] = ["user", "global"];
            const bucketsToCache: { name: string; bucketDir: string }[] = [];
            
            // Collect all buckets first
            for (const scope of scopes) {
                const buckets = findAllBucketsInScope(scope);
                bucketsToCache.push(...buckets);
            }
            
            // Process buckets in parallel batches to avoid overwhelming the system
            const BATCH_SIZE = 3; // Process 3 buckets at once
            for (let i = 0; i < bucketsToCache.length; i += BATCH_SIZE) {
                const batch = bucketsToCache.slice(i, i + BATCH_SIZE);
                
                const batchPromises = batch.map(async (bucketInfo) => {
                    try {
                        if (!existsSync(bucketInfo.bucketDir)) return;
                        
                        // Only build cache if not already cached
                        const cached = getCachedBucketContents(bucketInfo.bucketDir);
                        if (!cached) {
                            await new Promise(resolve => {
                                // Use setImmediate to yield control to the event loop
                                setImmediate(() => {
                                    buildBucketCache(bucketInfo.bucketDir);
                                    resolve(void 0);
                                });
                            });
                        }
                    } catch {
                        // Skip failed buckets
                    }
                });
                
                await Promise.all(batchPromises);
                
                // Small delay between batches to prevent blocking
                if (i + BATCH_SIZE < bucketsToCache.length) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
        } catch {
            // Fail silently - cache preloading is a performance optimization
        }
    })();
    
    return cachePreloadingPromise;
}

// Optimized cache building with progress feedback
function buildBucketCacheOptimized(bucketDir: string, showProgress = false): Record<string, CachedPackageData> | null {
    try {
        if (!existsSync(bucketDir)) return null;

        const contents: Record<string, CachedPackageData> = {};
        
        // Get all JSON files efficiently
        const files = readdirSync(bucketDir, { withFileTypes: true })
            .filter(f => f.isFile() && f.name.endsWith(".json"))
            .map(f => f.name.slice(0, -5)); // Remove .json extension

        const totalFiles = files.length;
        let processedFiles = 0;
        
        if (showProgress && totalFiles > 100) {
            console.log(`Building cache for ${basename(bucketDir)} bucket (${totalFiles} packages)...`);
        }

        // Process files in small batches to avoid blocking the event loop
        const BATCH_SIZE = 50;
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
            const batch = files.slice(i, i + BATCH_SIZE);
            
            for (const appName of batch) {
                try {
                    const manifestPath = join(bucketDir, `${appName}.json`);
                    
                    // Quick file size check - skip very large manifests
                    const stats = statSync(manifestPath);
                    if (stats.size > 100000) continue; // Skip files larger than 100KB

                    const manifestContent = readFileSync(manifestPath, "utf8");
                    const manifest = JSON.parse(manifestContent);

                    // Extract and cache only essential search data
                    const packageData: CachedPackageData = {
                        version: manifest.version,
                        description: manifest.description
                    };

                    // Extract binary names for binary search optimization
                    if (manifest.bin) {
                        if (Array.isArray(manifest.bin)) {
                            packageData.binaries = manifest.bin;
                        } else if (typeof manifest.bin === 'object') {
                            packageData.binaries = Object.keys(manifest.bin);
                        } else if (typeof manifest.bin === 'string') {
                            packageData.binaries = [manifest.bin];
                        }
                    }

                    // Also check shortcuts for additional binaries
                    if (manifest.shortcuts) {
                        const shortcutBinaries = manifest.shortcuts
                            .map((s: any) => {
                                if (Array.isArray(s) && s.length > 0) {
                                    const path = s[0];
                                    return path.split(/[\\\/]/).pop()?.replace(/\.[^.]*$/, '');
                                }
                                return null;
                            })
                            .filter((b: any) => b);
                        
                        if (shortcutBinaries.length > 0) {
                            packageData.binaries = [...(packageData.binaries || []), ...shortcutBinaries];
                        }
                    }

                    contents[appName] = packageData;
                } catch {
                    // Skip individual manifest parse errors
                    continue;
                }
                
                processedFiles++;
            }
            
            // Show progress for large buckets
            if (showProgress && totalFiles > 100 && processedFiles % 100 === 0) {
                const percent = Math.round((processedFiles / totalFiles) * 100);
                console.log(`  Progress: ${processedFiles}/${totalFiles} (${percent}%)`);
            }
        }

        // Cache the results
        bucketCaches.set(bucketDir, {
            contents,
            timestamp: Date.now(),
            bucketPath: bucketDir
        });

        if (showProgress && totalFiles > 100) {
            console.log(`  Completed: ${processedFiles} packages cached`);
        }

        return contents;
    } catch {
        return null;
    }
}

// Clear stale caches periodically
setInterval(clearStaleBucketCaches, BUCKET_CACHE_TTL_MS / 2);

export const definition: CommandDefinition = {
    name: "search",
    description: "Search for packages in Scoop buckets",
    options: [
        {
            flags: "-b, --bucket",
            description: "Search in specific bucket only",
        },
        {
            flags: "-i, --installed-only",
            description: "Show only installed packages",
        },
        {
            flags: "-c, --case-sensitive",
            description: "Use case-sensitive matching",
        },
        {
            flags: "-v, --verbose",
            description: "Show detailed package information",
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        const startTime = performance.now();

        const query = args.args[0];
        if (!query) {
            error("Usage: swb search <query>");
            return 1;
        }

        const options = {
            caseSensitive: Boolean(args.flags["case-sensitive"] || args.flags.c),
            bucket: (args.flags["bucket"] as string) || (args.flags.b as string),
            installedOnly: Boolean(args.flags["installed-only"] || args.flags.i),
        };

        const verbose = Boolean(args.flags["verbose"] || args.flags.v);

        try {
            const results = await searchBuckets(query, options);
            const searchTime = performance.now() - startTime;

            formatResults(results, verbose);

            // Performance logging for debugging cold start issues
            if (searchTime > 5000) {
                warn(
                    `Search took ${(searchTime / 1000).toFixed(2)}s - consider optimizing bucket structure`
                );
            }

            return 0;
        } catch (err) {
            error(`Search failed: ${err instanceof Error ? err.message : "Unknown error"}`);
            return 1;
        }
    },
};;
