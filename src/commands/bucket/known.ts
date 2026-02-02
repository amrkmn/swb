import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { bold, cyan, dim, green } from "src/utils/colors";
import { formatLineColumns } from "src/utils/helpers";
import { z } from "zod";

const KnownArgs = z.object({});
const KnownFlags = z.object({
    json: z.boolean().default(false).optional(),
});

export class BucketKnownCommand extends Command<typeof KnownArgs, typeof KnownFlags> {
    name = "known";
    description = "List all known official buckets";
    argsSchema = KnownArgs;
    flagsSchema = KnownFlags;

    flagAliases = {
        j: "json",
    };

    async run(ctx: Context, _args: any, flags: z.infer<typeof KnownFlags>) {
        const { logger, services } = ctx;
        const bucketService = services.buckets;

        const buckets = bucketService.known();
        const isJson = flags.json;

        if (isJson) {
            logger.log(JSON.stringify(buckets, null, 2));
            return 0;
        }

        if (buckets.length === 0) {
            logger.warn("No known buckets found.");
            return 0;
        }

        // Prepare table data with header
        const tableData: string[][] = [["Name", "Source"].map(h => bold(green(h)))];

        for (const bucket of buckets) {
            const name = cyan(bucket.name);
            const source = bucket.source;
            tableData.push([name, source]);
        }

        const formattedTable = formatLineColumns(tableData, {
            weights: [1.0, 3.0],
        });

        logger.log(formattedTable);
        logger.newline();
        logger.log(dim(`${buckets.length} known bucket${buckets.length !== 1 ? "s" : ""}`));

        return 0;
    }
}
