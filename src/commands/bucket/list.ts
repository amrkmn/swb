import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { bold, cyan, dim, green } from "src/utils/colors";
import { formatLineColumns } from "src/utils/helpers";
import { z } from "zod";

const ListArgs = z.object({});
const ListFlags = z.object({});

export class BucketListCommand extends Command<typeof ListArgs, typeof ListFlags> {
    name = "list";
    description = "List all configured buckets";
    argsSchema = ListArgs;
    flagsSchema = ListFlags;

    async run(ctx: Context, _args: any, _flags: any) {
        const { logger, services } = ctx;
        const bucketService = services.buckets;

        // List user buckets
        const buckets = await bucketService.list("user");

        if (buckets.length === 0) {
            logger.warn("No buckets installed.");
        } else {
            // Prepare table data with header
            const tableData: string[][] = [
                ["Name", "Source", "Updated", "Manifests"].map(h => bold(green(h))),
            ];

            for (const bucket of buckets) {
                const name = cyan(bucket.name);
                const source = bucket.source;
                const updated = this.formatDate(bucket.updated);
                const manifests = bucket.manifests.toString();

                tableData.push([name, source, updated, manifests]);
            }

            const formattedTable = formatLineColumns(tableData, {
                weights: [1.0, 3.0, 1.5, 0.5],
            });

            logger.log(formattedTable);
            logger.newline();
            logger.log(dim(`${buckets.length} bucket${buckets.length !== 1 ? "s" : ""} installed`));
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
