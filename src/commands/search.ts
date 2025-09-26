import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { error, warn } from "src/utils/logger.ts";
import { listInstalledApps } from "src/lib/apps.ts";
import { findAllBucketsInScope } from "src/lib/manifests.ts";
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { blue, bold, cyan, dim, green, yellow } from "src/utils/colors.ts";

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

// Multi-threaded search through all available manifests in buckets
async function searchBuckets(
    query: string,
    options: {
        caseSensitive?: boolean;
        bucket?: string;
        installedOnly?: boolean;
    }
): Promise<SearchResult[]> {
    const flags = options.caseSensitive ? "" : "i";
    const pattern = new RegExp(query, flags);

    // Get list of installed apps for checking installation status
    const installedApps = listInstalledApps();
    const installedSet = new Set(installedApps.map(app => app.name.toLowerCase()));

    const scopes: ("user" | "global")[] = ["user", "global"];
    const isSimpleQuery = query.length > 1 && !/[.*+?^${}()|[\]\\]/.test(query);

    // Process individual bucket with multi-threading
    const processBucket = (
        bucketInfo: { name: string; bucketDir: string },
        scope: "user" | "global"
    ): Promise<SearchResult[]> => {
        return new Promise(resolve => {
            setImmediate(async () => {
                const results: SearchResult[] = [];
                const seenPackages = new Set<string>();

                try {
                    if (!existsSync(bucketInfo.bucketDir)) {
                        resolve(results);
                        return;
                    }

                    // Read directory contents directly
                    const files = readdirSync(bucketInfo.bucketDir, { withFileTypes: true })
                        .filter(f => f.isFile() && f.name.endsWith(".json"))
                        .map(f => f.name.slice(0, -5)); // Remove .json extension

                    // Sort packages to prioritize exact matches first
                    if (isSimpleQuery) {
                        files.sort((a, b) => {
                            const aExact = a.toLowerCase() === query.toLowerCase();
                            const bExact = b.toLowerCase() === query.toLowerCase();
                            if (aExact && !bExact) return -1;
                            if (!aExact && bExact) return 1;
                            return 0;
                        });
                    }

                    // Process files in batches to avoid blocking
                    const BATCH_SIZE = 25;
                    for (let i = 0; i < files.length; i += BATCH_SIZE) {
                        const batch = files.slice(i, i + BATCH_SIZE);

                        for (const appName of batch) {
                            try {
                                const packageKey = `${bucketInfo.name}:${appName}`;
                                if (seenPackages.has(packageKey)) continue;

                                const isInstalled = installedSet.has(appName.toLowerCase());
                                if (options.installedOnly && !isInstalled) continue;

                                // Quick name check first
                                if (pattern.test(appName)) {
                                    seenPackages.add(packageKey);

                                    // Read manifest for version/description
                                    let version: string | undefined;
                                    let description: string | undefined;

                                    try {
                                        const manifestPath = join(
                                            bucketInfo.bucketDir,
                                            `${appName}.json`
                                        );
                                        const stats = statSync(manifestPath);
                                        if (stats.size <= 100000) {
                                            // Skip very large files
                                            const manifestContent = readFileSync(
                                                manifestPath,
                                                "utf8"
                                            );
                                            const manifest = JSON.parse(manifestContent);
                                            version = manifest.version;
                                            description = manifest.description;
                                        }
                                    } catch {
                                        // Continue with basic info if manifest read fails
                                    }

                                    results.push({
                                        name: appName,
                                        version,
                                        bucket: bucketInfo.name,
                                        scope,
                                        description,
                                        binaries: undefined,
                                        isInstalled,
                                    });

                                    continue;
                                }

                                // If name doesn't match, check binaries for simple queries
                                if (isSimpleQuery && query.length > 2) {
                                    try {
                                        const manifestPath = join(
                                            bucketInfo.bucketDir,
                                            `${appName}.json`
                                        );
                                        const stats = statSync(manifestPath);
                                        if (stats.size <= 100000) {
                                            // Skip very large files
                                            const manifestContent = readFileSync(
                                                manifestPath,
                                                "utf8"
                                            );
                                            const binaryMatches = searchInBinaries(
                                                manifestContent,
                                                pattern
                                            );

                                            if (binaryMatches.length > 0) {
                                                seenPackages.add(packageKey);
                                                const manifest = JSON.parse(manifestContent);

                                                results.push({
                                                    name: appName,
                                                    version: manifest.version,
                                                    bucket: bucketInfo.name,
                                                    scope,
                                                    description: manifest.description,
                                                    binaries: binaryMatches,
                                                    isInstalled,
                                                });
                                            }
                                        }
                                    } catch {
                                        // Skip failed manifest reads
                                    }
                                }

                                // Limit results per bucket
                                if (results.length >= 50) {
                                    break;
                                }
                            } catch {
                                // Skip failed package processing
                                continue;
                            }
                        }

                        // Small yield between batches to maintain responsiveness
                        if (i + BATCH_SIZE < files.length) {
                            await new Promise(resolve => setImmediate(resolve));
                        }
                    }
                } catch (error) {
                    // Skip bucket on error
                }

                resolve(results);
            });
        });
    };

    // Collect all bucket processing promises for parallel execution
    const allBucketPromises: Promise<SearchResult[]>[] = [];

    for (const scope of scopes) {
        const buckets = findAllBucketsInScope(scope);

        for (const bucketInfo of buckets) {
            // Skip if specific bucket requested and this isn't it
            if (options.bucket && bucketInfo.name !== options.bucket) {
                continue;
            }

            // Create a promise for processing this bucket in parallel
            const bucketPromise = processBucket(bucketInfo, scope);
            allBucketPromises.push(bucketPromise);
        }
    }

    // Process all buckets concurrently with controlled parallelism
    const CONCURRENT_BUCKETS = 6; // Process up to 6 buckets simultaneously
    const allResults: SearchResult[] = [];
    const seenPackages = new Set<string>(); // Global deduplication across all buckets

    // Process buckets in batches to limit concurrent operations while maximizing parallelism
    for (let i = 0; i < allBucketPromises.length; i += CONCURRENT_BUCKETS) {
        const batch = allBucketPromises.slice(i, i + CONCURRENT_BUCKETS);

        try {
            const batchResults = await Promise.all(batch);

            // Flatten results and deduplicate across buckets
            for (const bucketResults of batchResults) {
                for (const result of bucketResults) {
                    const packageKey = `${result.name.toLowerCase()}`;

                    // Global deduplication - prefer results from earlier scopes/buckets
                    if (!seenPackages.has(packageKey)) {
                        seenPackages.add(packageKey);
                        allResults.push(result);
                    }
                }
            }
        } catch (error) {
            // Continue processing other batches even if one fails
            continue;
        }

        // Limit total results to prevent excessive processing
        if (allResults.length >= 100) {
            break;
        }
    }

    // Sort results: exact matches first, then by name
    allResults.sort((a, b) => {
        if (isSimpleQuery) {
            const aExact = a.name.toLowerCase() === query.toLowerCase();
            const bExact = b.name.toLowerCase() === query.toLowerCase();
            if (aExact && !bExact) return -1;
            if (!aExact && bExact) return 1;
        }
        return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });

    return allResults;
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
        console.log(`${i === 0 ? "" : "\n"}${yellow(`'${bucketName}' bucket:`)}`);

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

            console.log(line);

            if (verbose && result.description) {
                console.log(`        ${dim(result.description)}`);
            }

            if (result.binaries && result.binaries.length > 0) {
                const binariesText = result.binaries.map(bin => green(bin)).join("', '");
                console.log(`        ${dim("-->")} includes '${binariesText}'`);
            }
        }
    }

    console.log(`\n${blue(`Found ${results.length} package(s).`)}`);
}

export const definition: CommandDefinition = {
    name: "search",
    description: "Search for packages in Scoop buckets using multi-threaded processing",
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

            // Performance logging for debugging slow searches
            if (searchTime > 10000) {
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
};
