import {
    cleanupApp,
    displayAppCleanupResult,
    displayCleanupSummary,
    type CleanupResult,
} from "src/lib/commands/cleanup.ts";
import { listInstalledApps } from "src/lib/apps.ts";
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import type { InstallScope } from "src/lib/paths.ts";
import { error } from "src/utils/logger.ts";

export const definition: CommandDefinition = {
    name: "cleanup",
    description: "Remove old versions of installed apps",
    arguments: [
        {
            name: "app",
            description: "App name(s) to clean up (or * for all apps)",
            required: false,
            variadic: true,
        },
    ],
    options: [
        {
            flags: "-a, --all",
            description: "Clean up all installed apps",
        },
        {
            flags: "-k, --cache",
            description: "Remove outdated download cache files",
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const appNames = args.args;
            const cleanAll = Boolean(args.flags.all || args.flags.a);
            const cache = Boolean(args.flags.cache || args.flags.k);
            const verbose = Boolean(args.flags.verbose || args.global.verbose);
            const useGlobal = Boolean(args.flags.global || args.global.global);

            // Determine which apps to clean up
            let appsToClean: Array<{ name: string; scope: InstallScope }> = [];

            if (cleanAll || (appNames.length === 1 && appNames[0] === "*")) {
                // Clean up all installed apps
                const installedApps = listInstalledApps();
                appsToClean = installedApps.map(app => ({
                    name: app.name,
                    scope: app.scope,
                }));
            } else if (appNames.length > 0) {
                // Clean up specific apps
                const installedApps = listInstalledApps();
                for (const appName of appNames) {
                    const found = installedApps.filter(app => app.name === appName);
                    if (found.length === 0) {
                        error(`'${appName}' is not installed`);
                        return 1;
                    }
                    // Add all scopes where the app is installed
                    appsToClean.push(...found.map(app => ({ name: app.name, scope: app.scope })));
                }
            } else {
                error("Please specify app name(s) or use --all to clean up all apps");
                return 1;
            }

            if (appsToClean.length === 0) {
                error("No apps to clean up");
                return 1;
            }

            // Perform cleanup
            const results: CleanupResult[] = [];
            for (const { name, scope } of appsToClean) {
                const result = cleanupApp(name, scope, {
                    cache,
                    global: useGlobal,
                    verbose,
                    suppressWarnings: false, // Show inline warnings for each app
                });
                results.push(result);
            }

            // Calculate max app name width for alignment using Bun.stringWidth
            let maxWidth = 0;
            for (const result of results) {
                const scopeStr = result.scope === "global" ? " (global)" : "";
                const width = Bun.stringWidth(`${result.app}${scopeStr}`);
                if (width > maxWidth) {
                    maxWidth = width;
                }
            }

            // Display all results with aligned columns
            for (const result of results) {
                displayAppCleanupResult(result, maxWidth);
            }

            // Show detailed errors for failed removals
            for (const result of results) {
                if (result.failedVersions.length > 0) {
                    for (const failed of result.failedVersions) {
                        const errorMsg = failed.error;
                        if (errorMsg.includes("EBUSY") || errorMsg.includes("resource busy")) {
                            error(
                                `  ${result.app} ${failed.version}: app may be running. Close it and try again.`
                            );
                        } else if (
                            errorMsg.includes("EPERM") ||
                            errorMsg.includes("permission denied")
                        ) {
                            error(
                                `  ${result.app} ${failed.version}: permission denied. Try running as administrator.`
                            );
                        } else {
                            error(`  ${result.app} ${failed.version}: ${errorMsg}`);
                        }
                    }
                }
            }

            // Display summary
            displayCleanupSummary(results);

            return 0;
        } catch (err) {
            error(`Cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
            return 1;
        }
    },
};
