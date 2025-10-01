import { printInfo } from "src/lib/commands/info.ts";
import { findAllManifests } from "src/lib/manifests.ts";
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { error, info } from "src/utils/logger";

// New style command definition
export const definition: CommandDefinition = {
    name: "info",
    description: "Show detailed info about an app",
    arguments: [
        {
            name: "app",
            description: "App name, optionally bucket/app",
            required: true,
        },
    ],
    options: [],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const appInput = args.args[0];
            if (!appInput) {
                error("App name is required");
                return 1;
            }

            const verbose = Boolean(args.flags.verbose || args.global.verbose);

            // Search comprehensively for the app across all buckets and scopes
            const results = findAllManifests(appInput);

            if (results.length === 0) {
                error(`Could not find '${appInput}' in installed apps or local buckets.`);
                info(
                    `\nTip: Try 'swb search ${appInput}' to find similar apps or check if buckets are up to date.`
                );
                return 1;
            }

            // Show the primary result (prefer installed if available)
            const primary = results.find(r => r.source === "installed") || results[0];
            await printInfo(primary, verbose);

            return 0;
        } catch (err) {
            error(`${err instanceof Error ? err.message : String(err)}`);
            return 1;
        }
    },
};;
