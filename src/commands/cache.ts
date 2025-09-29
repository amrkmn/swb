import { updateSearchCache, clearSearchCache } from "src/lib/commands/search";
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { error, success, info } from "src/utils/logger.ts";

export const definition: CommandDefinition = {
    name: "cache",
    description: "Manage search cache for faster performance",
    options: [
        {
            flags: "-c, --clear",
            description: "Clear the search cache",
        },
        {
            flags: "-u, --update",
            description: "Update the search cache",
        },
        {
            flags: "-f, --force",
            description: "Force update even if cache is recent",
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const shouldClear = Boolean(args.flags.clear);
            const shouldUpdate = Boolean(args.flags.update);
            const force = Boolean(args.flags.force);

            if (shouldClear) {
                info("Clearing search cache...");
                clearSearchCache();
                success("Search cache cleared successfully");
                return 0;
            }

            if (shouldUpdate || (!shouldClear && !shouldUpdate)) {
                // Default action is update
                info(`${force ? "Force updating" : "Updating"} search cache...`);
                const startTime = performance.now();
                await updateSearchCache(force);
                const elapsed = Math.round(performance.now() - startTime);
                success(`Search cache updated successfully in ${elapsed}ms`);
                return 0;
            }

            return 0;
        } catch (err) {
            error(`Cache operation failed: ${err instanceof Error ? err.message : String(err)}`);
            return 1;
        }
    },
};