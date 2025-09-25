import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";
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
function searchBuckets(
    query: string,
    options: {
        caseSensitive?: boolean;
        bucket?: string;
        installedOnly?: boolean;
    }
): SearchResult[] {
    const results: SearchResult[] = [];
    const flags = options.caseSensitive ? "" : "i";
    const pattern = new RegExp(query, flags);

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

                // Get all JSON files at once using withFileTypes for better performance
                const files = readdirSync(bucketInfo.bucketDir, { withFileTypes: true })
                    .filter(f => f.isFile() && f.name.endsWith(".json"))
                    .map(f => f.name.slice(0, -5)); // Remove .json extension more efficiently

                // Sort files to prioritize exact matches first
                if (isSimpleQuery) {
                    files.sort((a, b) => {
                        const aExact = a.toLowerCase() === query.toLowerCase();
                        const bExact = b.toLowerCase() === query.toLowerCase();
                        if (aExact && !bExact) return -1;
                        if (!aExact && bExact) return 1;
                        return 0;
                    });
                }

                for (const appName of files) {
                    const packageKey = `${bucketInfo.name}:${appName}`;

                    // Skip duplicates across scopes
                    if (seenPackages.has(packageKey)) continue;

                    const isInstalled = installedSet.has(appName.toLowerCase());

                    // Early exit: Skip if installed-only filter is set and app is not installed
                    if (options.installedOnly && !isInstalled) {
                        continue;
                    }

                    // Quick name check first - if it matches, we're done for this package
                    if (pattern.test(appName)) {
                        seenPackages.add(packageKey);

                        // Mark as exact match for potential early termination
                        if (isSimpleQuery && appName.toLowerCase() === query.toLowerCase()) {
                            exactMatches.add(appName.toLowerCase());
                        }

                        // Only read manifest if we need metadata (for verbose output)
                        let manifest: any = {};
                        try {
                            const manifestPath = join(bucketInfo.bucketDir, `${appName}.json`);
                            const manifestContent = readFileSync(manifestPath, "utf8");
                            manifest = JSON.parse(manifestContent);
                        } catch {
                            // Continue with name match even if manifest can't be read
                        }

                        results.push({
                            name: appName,
                            version: manifest.version,
                            bucket: bucketInfo.name,
                            scope,
                            description: manifest.description,
                            binaries: undefined,
                            isInstalled,
                        });

                        // Early termination: if we found exact matches and have reasonable results, stop searching
                        if (exactMatches.size > 0 && results.length >= 10) {
                            return results;
                        }

                        continue; // Skip binary search for this package
                    }

                    // Name doesn't match - check binaries only for simple queries
                    if (isSimpleQuery && query.length > 2) {
                        try {
                            const manifestPath = join(bucketInfo.bucketDir, `${appName}.json`);

                            // Quick file size check - skip very large manifests for performance
                            const stats = statSync(manifestPath);
                            if (stats.size > 50000) continue; // Skip files larger than 50KB

                            const manifestContent = readFileSync(manifestPath, "utf8");

                            // Quick check if the query appears anywhere in the manifest
                            if (manifestContent.toLowerCase().includes(query.toLowerCase())) {
                                const binaryMatches = searchInBinaries(manifestContent, pattern);

                                if (binaryMatches.length > 0) {
                                    const manifest = JSON.parse(manifestContent);
                                    seenPackages.add(packageKey);
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
                            // Continue on error
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
            const results = searchBuckets(query, options);
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
};
