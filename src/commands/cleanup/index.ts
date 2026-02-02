import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import type { CleanupResult } from "src/services/CleanupService";
import { z } from "zod";
import { displayAppCleanupResult, displayCleanupSummary } from "./views";

const CleanupArgs = z.object({
    app: z.string().optional(),
});

const CleanupFlags = z.object({
    all: z.boolean().default(false).describe("Cleanup all apps"),
    cache: z.boolean().default(false).describe("Clear download cache"),
    global: z.boolean().default(false).describe("Cleanup global apps"),
    verbose: z.boolean().default(false).describe("Show detailed output"),
    "dry-run": z.boolean().default(false).describe("Simulate cleanup without deleting files"),
});

export class CleanupCommand extends Command<typeof CleanupArgs, typeof CleanupFlags> {
    name = "cleanup";
    description = "Remove old versions of installed apps";
    argsSchema = CleanupArgs;
    flagsSchema = CleanupFlags;

    flagAliases = {
        a: "all",
        k: "cache",
        g: "global",
        v: "verbose",
    };

    async run(
        ctx: Context,
        args: z.infer<typeof CleanupArgs>,
        flags: z.infer<typeof CleanupFlags>
    ) {
        const { logger, services } = ctx;
        const appsService = services.apps;
        const cleanupService = services.cleanup;

        const cleanAll = flags.all || args.app === "*";
        const cache = flags.cache;
        const global = flags.global;
        const verbose = flags.verbose;
        const dryRun = flags["dry-run"];

        let appsToClean: Array<{ name: string; scope: "user" | "global" }> = [];

        if (cleanAll) {
            const installed = appsService.listInstalled();
            appsToClean = installed.map(app => ({ name: app.name, scope: app.scope }));
        } else if (args.app) {
            // Check if installed
            const installed = appsService.listInstalled();
            const found = installed.find(a => a.name.toLowerCase() === args.app!.toLowerCase());

            if (!found) {
                logger.error(`'${args.app}' is not installed`);
                return 1;
            }
            appsToClean.push({ name: found.name, scope: found.scope });
        } else {
            logger.error("Please specify app name or use --all to clean up all apps");
            return 1;
        }

        if (appsToClean.length === 0) {
            logger.error("No apps to clean up");
            return 1;
        }

        const results: CleanupResult[] = [];
        for (const { name, scope } of appsToClean) {
            const result = cleanupService.cleanupApp(name, scope, {
                cache,
                global,
                verbose,
                dryRun,
                suppressWarnings: false,
            });
            results.push(result);
        }

        // Calculate max width for alignment
        let maxWidth = 0;
        for (const result of results) {
            // Simple length check
            if (result.app.length > maxWidth) maxWidth = result.app.length;
        }

        for (const result of results) {
            displayAppCleanupResult(logger, result, maxWidth);
        }

        displayCleanupSummary(logger, results);

        return 0;
    }
}
