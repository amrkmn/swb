import { formatResults, searchBuckets, type SearchResult } from "src/lib/commands/search";
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { getBucketCount } from "src/lib/search";
import { error } from "src/utils/logger.ts";
import { ProgressBar } from "src/utils/loader.ts";

export const definition: CommandDefinition = {
    name: "search",
    description: "Search for packages in Scoop buckets",
    options: [
        {
            flags: "-b, --bucket",
            description: "Search in specific bucket only",
        },
        {
            flags: "-c, --case-sensitive",
            description: "Use case-sensitive search",
        },
        {
            flags: "-i, --installed",
            description: "Search only installed packages",
        },
    ],
    arguments: [
        {
            name: "query",
            description: "Search query (supports regex patterns)",
            required: true,
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const query = args.args[0];
            if (!query) {
                error("Search query is required");
                return 1;
            }

            const options = {
                caseSensitive: Boolean(args.flags["case-sensitive"]),
                bucket: args.flags.bucket as string | undefined,
                installedOnly: Boolean(args.flags.installed),
            };

            const verbose = Boolean(args.flags.verbose || args.global.verbose);

            // Get bucket count for progress bar
            const bucketCount = getBucketCount();
            const progress = new ProgressBar(bucketCount, "Searching");
            progress.start();

            // Perform the search with progress callback
            const results: SearchResult[] = await searchBuckets(
                query,
                options,
                verbose,
                (completed, total, bucketName) => {
                    progress.setProgress(completed, `Searching ${bucketName}`);
                }
            );

            progress.stop();

            // Display results
            formatResults(results, verbose);

            return 0;
        } catch (err) {
            error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
            return 1;
        }
    },
};
