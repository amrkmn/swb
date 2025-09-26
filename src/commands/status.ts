import {
    checkScoopStatus,
    displayStatus,
    displayStatusJson,
    getAppStatus,
    type AppStatus,
} from "src/lib/commands/status.ts";
import { listInstalledApps } from "src/lib/apps.ts";
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { Loading } from "src/utils/loader.ts";
import { error, log, warn } from "src/utils/logger.ts";

export const definition: CommandDefinition = {
    name: "status",
    description: "Show status of installed packages",
    options: [
        {
            flags: "-l, --local",
            description: "Check status only locally (skip remote updates)",
        },
        {
            flags: "-j, --json",
            description: "Output in JSON format",
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const local = Boolean(args.flags.local || args.flags.l);
            const json = Boolean(args.flags.json || args.flags.j);
            let loader: Loading | null = null;

            if (!local && !json) {
                loader = new Loading("Checking for updates");
                loader.start();
            }

            // Get all installed apps
            const installedApps = listInstalledApps();

            if (installedApps.length === 0) {
                if (json) {
                    log(
                        JSON.stringify(
                            {
                                scoop: { outdated: false },
                                buckets: { outdated: false },
                                apps: [],
                            },
                            null,
                            2
                        )
                    );
                } else {
                    loader?.stop();
                    warn("No packages installed.");
                }
                return 0;
            }

            // Check Scoop and bucket status
            const scoopStatus = await checkScoopStatus(local);

            // Get status for each installed app
            const statuses: AppStatus[] = [];
            for (const app of installedApps) {
                const status = await getAppStatus(app);
                if (status) {
                    // Filter out null results (like 'scoop' app)
                    statuses.push(status);
                }
            }
            loader?.stop();

            // Display results
            if (json) displayStatusJson(statuses, scoopStatus);
            else displayStatus(statuses, scoopStatus);

            return 0;
        } catch (e) {
            error(e instanceof Error ? e.message : String(e));
            return 1;
        }
    },
};