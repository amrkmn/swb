import {
    displayAppsList,
    displayAppsListJson,
    displayListSummary,
    getAppsListInfo,
} from "src/lib/commands/list.ts";
import { listInstalledApps } from "src/lib/apps.ts";
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { warning } from "src/utils/colors.ts";
import { error, log } from "src/utils/logger.ts";

export const definition: CommandDefinition = {
    name: "list",
    description: "List installed apps",
    arguments: [
        {
            name: "query",
            description: "Optional filter substring on app name",
            required: false,
        },
    ],
    options: [
        {
            flags: "-j, --json",
            description: "Output in JSON format",
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const query = args.args[0];
            const json = Boolean(args.flags.json || args.flags.j);
            const apps = listInstalledApps(query ?? undefined);

            if (apps.length === 0) {
                if (json) {
                    log("[]");
                } else {
                    log(warning("No apps installed."));
                }
                return 0;
            }

            // Get extended info for all apps
            const appsInfo = getAppsListInfo(apps);

            if (json) {
                displayAppsListJson(appsInfo);
            } else {
                displayAppsList(appsInfo);
                displayListSummary(apps.length, query);
            }

            return 0;
        } catch (err) {
            error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            return 1;
        }
    },
};
