import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { listInstalledApps } from "../lib/apps.ts";
import { findAllBucketsInScope } from "../lib/manifests.ts";
import type { CommandDefinition, ParsedArgs } from "../lib/parser.ts";

// Search result interface
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
                        continue; // Skip binary search for this package
                    }

                    // Name doesn't match - check binaries only if necessary
                    // Skip binary search entirely if it's a simple exact match query
                    if (
                        query.length > 2 &&
                        !query.includes(".") &&
                        !query.includes("*") &&
                        !query.includes("?")
                    ) {
                        // For simple queries, try a quick check first
                        try {
                            const manifestPath = join(bucketInfo.bucketDir, `${appName}.json`);
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
        console.log("No packages found.");
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
        console.log(`${i === 0 ? "" : "\n"}'${bucketName}' bucket:`);

        // Sort results within bucket (installed first, then alphabetical)
        bucketResults.sort((a, b) => {
            if (a.isInstalled !== b.isInstalled) {
                return a.isInstalled ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        for (const result of bucketResults) {
            let line = `    ${result.name}`;

            if (result.version) {
                line += ` (${result.version})`;
            }

            if (result.isInstalled) {
                line += " [installed]";
            }

            console.log(line);

            if (verbose && result.description) {
                console.log(`        ${result.description}`);
            }

            if (result.binaries && result.binaries.length > 0) {
                console.log(`        --> includes '${result.binaries.join("', '")}'`);
            }
        }
    }

    console.log(`\nFound ${results.length} package(s).`);
}

// New style command definition
export const definition: CommandDefinition = {
    name: "search",
    description: "Search for packages in available buckets",
    arguments: [
        {
            name: "query",
            description: "Search pattern (supports regular expressions)",
            required: true,
        },
    ],
    options: [
        {
            flags: "-b, --bucket <bucket>",
            description: "Search in a specific bucket only",
        },
        {
            flags: "-i, --installed",
            description: "Search only installed packages",
        },
        {
            flags: "-s, --case-sensitive",
            description: "Case-sensitive search",
        },
        {
            flags: "--verbose",
            description: "Show detailed information",
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const query = args.args[0];
            if (!query) {
                console.error("Search query is required");
                return 1;
            }

            const bucket = args.flags.bucket || args.flags.b;
            const installedOnly = Boolean(args.flags.installed || args.flags.i);
            const caseSensitive = Boolean(args.flags["case-sensitive"] || args.flags.s);
            const verbose = Boolean(args.flags.verbose || args.global.verbose);

            // Validate regex pattern
            try {
                new RegExp(query, caseSensitive ? "" : "i");
            } catch (error) {
                console.error(
                    `Invalid regular expression: ${error instanceof Error ? error.message : String(error)}`
                );
                return 1;
            }

            const results = searchBuckets(query, {
                bucket: typeof bucket === "string" ? bucket : undefined,
                installedOnly,
                caseSensitive,
            });

            formatResults(results, verbose);
            return 0;
        } catch (error) {
            console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
            return 1;
        }
    },
};
