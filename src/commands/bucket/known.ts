/**
 * Bucket known subcommand - List all known buckets
 */

import { getAllKnownBuckets } from "src/utils/known-buckets.ts";
import type { ParsedArgs } from "src/lib/parser.ts";
import { log } from "src/utils/logger.ts";

/**
 * List known buckets
 */
export async function handler(args: ParsedArgs): Promise<number> {
    const json = args.flags.json || false;
    const buckets = getAllKnownBuckets();

    if (json) {
        console.log(JSON.stringify(buckets, null, 2));
        return 0;
    }

    log("");
    log("Known buckets:");
    log("");

    // Header
    const nameCol = "Name".padEnd(20);
    const sourceCol = "Source";

    log(`  ${nameCol} ${sourceCol}`);
    log(`  ${"─".repeat(20)} ${"─".repeat(60)}`);

    // Rows
    for (const bucket of buckets) {
        const name = bucket.name.padEnd(20);
        const source = bucket.source;

        log(`  ${name} ${source}`);
    }

    log("");
    log("To add a bucket:");
    log("  swb bucket add <name>");
    log("");

    return 0;
}

export const help = `
Usage: swb bucket known [options]

List all officially recognized buckets from the Scoop project.

Options:
  --json   Output in JSON format

Examples:
  swb bucket known
  swb bucket known --json
`;
