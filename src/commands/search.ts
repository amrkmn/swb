import { formatResults, searchBuckets, type SearchResult } from "src/lib/commands/search.ts";
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { error } from "src/utils/logger.ts";

export const definition: CommandDefinition = {
    name: "search",
    description: "Search for packages in Scoop buckets using multi-threaded processing",
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
        {
            flags: "-v, --verbose",
            description: "Show package descriptions",
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

            // Perform the search
            const results: SearchResult[] = await searchBuckets(query, options);

            // Display results
            formatResults(results, verbose);

            return 0;
        } catch (err) {
            error(`Search failed: ${err instanceof Error ? err.message : String(err)}`);
            return 1;
        }
    },
};