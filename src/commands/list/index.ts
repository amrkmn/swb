import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { bold, cyan, dim, green, magenta, yellow } from "src/utils/colors";
import { formatLineColumns } from "src/utils/helpers";
import { z } from "zod";

const ListArgs = z.object({
    query: z.string().optional(),
});

const ListFlags = z.object({
    json: z.boolean().default(false),
});

export class ListCommand extends Command<typeof ListArgs, typeof ListFlags> {
    name = "list";
    description = "List installed apps";
    argsSchema = ListArgs;
    flagsSchema = ListFlags;

    flagAliases = {
        j: "json",
    };

    async run(ctx: Context, args: z.infer<typeof ListArgs>, flags: z.infer<typeof ListFlags>) {
        const { logger, services } = ctx;
        const appsService = services.apps;
        const isJson = flags.json;
        const query = args.query;

        const apps = appsService.listInstalled(query);

        if (apps.length === 0) {
            if (isJson) {
                logger.log("[]");
            } else {
                logger.warn(query ? `No apps matching "${query}" found.` : "No apps installed.");
            }
            return 0;
        }

        if (isJson) {
            const jsonOutput = apps.map((app: any) => ({
                name: app.name,
                version: app.version,
                bucket: app.bucket || null,
                updated: app.updated?.toISOString() || null,
                held: app.held,
                scope: app.scope,
            }));
            logger.log(JSON.stringify(jsonOutput, null, 2));
            return 0;
        }

        // Prepare table data with header
        const tableData: string[][] = [
            ["Name", "Version", "Source", "Updated", "Info"].map(h => bold(green(h))),
        ];

        for (const app of apps) {
            const name = cyan(app.name);
            const version = app.version || "unknown";

            // Source: bucket name or scope
            const source = app.bucket || (app.scope === "global" ? "global" : "");

            // Updated date
            const updated = this.formatDate(app.updated);

            // Info flags with colors
            const infoFlags: string[] = [];
            if (app.held) infoFlags.push(yellow("Held"));
            if (app.scope === "global") infoFlags.push(magenta("Global"));
            const info = infoFlags.join(", ");

            tableData.push([name, version, source, updated, info]);
        }

        const formattedTable = formatLineColumns(tableData, {
            weights: [2.0, 1.0, 1.0, 0.5, 1.5],
        });

        logger.log(formattedTable);
        logger.newline();

        if (query) {
            logger.log(
                dim(`${apps.length} app${apps.length !== 1 ? "s" : ""} matching "${query}"`)
            );
        } else {
            logger.log(dim(`${apps.length} app${apps.length !== 1 ? "s" : ""} installed`));
        }

        return 0;
    }

    private formatDate(date: Date | null): string {
        if (!date) return "";
        try {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            const hours = String(date.getHours()).padStart(2, "0");
            const minutes = String(date.getMinutes()).padStart(2, "0");
            const seconds = String(date.getSeconds()).padStart(2, "0");
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } catch {
            return "";
        }
    }
}
