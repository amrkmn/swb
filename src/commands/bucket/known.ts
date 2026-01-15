/**
 * Bucket known subcommand - List all known buckets
 */

import { getAllKnownBuckets } from "src/utils/known-buckets.ts";
import type { ParsedArgs } from "src/lib/parser.ts";
import { log, newline } from "src/utils/logger.ts";
import { bold, cyan, dim, green } from "src/utils/colors.ts";
import { formatLineColumns } from "src/utils/helpers.ts";

/**
 * Display known buckets in table format
 */
function displayKnownBuckets(buckets: Array<{ name: string; source: string }>): void {
    if (buckets.length === 0) return;

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
    log(formattedTable);
}

/**
 * Display summary line
 */
function displayKnownBucketsSummary(total: number): void {
    newline();
    log(dim(`${total} known bucket${total !== 1 ? "s" : ""}`));
}

/**
 * List known buckets
 */
export async function handler(args: ParsedArgs): Promise<number> {
    const json = args.flags.json || args.flags.j || false;
    const buckets = getAllKnownBuckets();

    if (json) {
        log(JSON.stringify(buckets, null, 2));
        return 0;
    }

    displayKnownBuckets(buckets);
    displayKnownBucketsSummary(buckets.length);

    return 0;
}

export const help = `
Usage: swb bucket known [options]

List all officially recognized buckets from the Scoop project.

Options:
  -j, --json   Output in JSON format

Examples:
  swb bucket known
  swb bucket known --json
`;
