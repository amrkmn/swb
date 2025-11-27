import {
    checkScoopStatus,
    displayAppStatus,
    displayScoopStatus,
    displayStatusJson,
} from "src/lib/commands/status.ts";
import { listInstalledApps } from "src/lib/apps.ts";
import { parallelStatusCheck, type AppStatusResult } from "src/lib/status/index.ts";
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { ProgressBar } from "src/utils/loader.ts";
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
                    warn("No packages installed.");
                }
                return 0;
            }

            // Total steps: 2 (scoop + buckets) + number of apps
            const totalSteps = 2 + installedApps.length;

            // Set up progress bar (only for non-JSON output)
            let progressBar: ProgressBar | null = null;
            if (!json) {
                progressBar = new ProgressBar(totalSteps, "Checking Scoop");
                progressBar.start();
            }

            // Check scoop and bucket status first
            const scoopStatus = await checkScoopStatus(local, step => {
                progressBar?.setStep(step);
                if (step === "Checking buckets") {
                    progressBar?.setProgress(1);
                }
            });

            // Update progress after scoop/bucket checks
            progressBar?.setProgress(2, "Checking apps");

            // Get status for each installed app using parallel workers
            const statuses = await parallelStatusCheck(installedApps, {
                onProgress: (completed, total) => {
                    // Offset by 2 for the scoop/bucket steps
                    progressBar?.setProgress(2 + completed);
                },
            });

            progressBar?.complete();

            // Display results
            if (json) {
                displayStatusJson(statuses, scoopStatus);
            } else {
                displayScoopStatus(scoopStatus);
                displayAppStatus(statuses);
            }

            return 0;
        } catch (e) {
            error(e instanceof Error ? e.message : String(e));
            return 1;
        }
    },
};
