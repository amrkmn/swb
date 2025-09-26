import { listInstalledApps } from "src/lib/apps.ts";
import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { cyan, dim, green, warning } from "src/utils/colors.ts";
import { error, log } from "src/utils/logger.ts";

function formatRow(name: string, version: string, flags: string[]): string {
    const flagStr = flags.length > 0 ? ` ${dim(`[${flags.join(", ")}]`)}` : "";
    return `${cyan(name)} ${green(version)}${flagStr}`;
}

// New style command definition
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
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const query = args.args[0];
            const apps = listInstalledApps(query ?? undefined);

            if (apps.length === 0) {
                log(warning("There aren't any apps installed."));
                return 1;
            }

            for (const a of apps) {
                const flags: string[] = [];
                if (a.scope === "global") flags.push("global");
                log(formatRow(a.name, a.version || "unknown", flags));
            }

            return 0;
        } catch (err) {
            error(`Error: ${err instanceof Error ? err.message : String(err)}`);
            return 1;
        }
    },
};
