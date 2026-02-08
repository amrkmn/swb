import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { z } from "zod";
import { formatSearchResults } from "./views";

const SearchArgs = z.object({
    query: z.string().min(1, "Search query cannot be empty"),
});

const SearchFlags = z.object({
    global: z.boolean().default(false),
    verbose: z.boolean().default(false),
    bucket: z.string().optional(),
    installed: z.boolean().default(false),
});

export class SearchCommand extends Command<typeof SearchArgs, typeof SearchFlags> {
    name = "search";
    description = "Search for apps in buckets";
    argsSchema = SearchArgs;
    flagsSchema = SearchFlags;

    flagAliases = {
        g: "global",
        v: "verbose",
        i: "installed",
    };

    async run(ctx: Context, args: z.infer<typeof SearchArgs>, flags: z.infer<typeof SearchFlags>) {
        const { logger, services } = ctx;
        const workerService = services.workers;
        const appsService = services.apps;

        logger.verbose(`Starting search for: "${args.query}"`);

        // Get installed apps for displaying installation status
        const apps = appsService.listInstalled();
        const installedMap = new Map<string, { bucket?: string; scope: string }>();

        for (const app of apps) {
            installedMap.set(app.name.toLowerCase(), {
                bucket: app.bucket || undefined,
                scope: app.scope,
            });
        }

        // If --installed flag is set, also create list for early filtering
        let installedApps: string[] | undefined;
        if (flags.installed) {
            installedApps = apps.map(app => app.name.toLowerCase());
            logger.verbose(`Filtering for ${installedApps.length} installed apps`);
        }

        // Start search
        const results = await workerService.search(
            args.query,
            {
                bucket: flags.bucket,
                caseSensitive: false,
                installedApps,
            },
            (completed: number, total: number, bucket: string) => {
                // Progress callback
            }
        );

        logger.verbose(`Found ${results.length} matches`);

        const finalResults = results.map((result: any) => {
            if (flags.installed) {
                // Already filtered by worker, just add scope info
                const installed = installedMap.get(result.name.toLowerCase());
                return {
                    ...result,
                    isInstalled: true,
                    scope: installed?.scope === "global" ? ("global" as const) : result.scope,
                };
            }

            const installed = installedMap.get(result.name.toLowerCase());
            const isInstalled =
                !!installed && (installed.bucket === result.bucket || !installed.bucket);

            return {
                ...result,
                isInstalled,
                scope: installed?.scope === "global" ? ("global" as const) : result.scope,
            };
        });

        // Cast back to SearchResult[] for the view
        formatSearchResults(logger, finalResults as any[], flags.verbose);

        return 0;
    }
}
