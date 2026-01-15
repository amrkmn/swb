/**
 * Bucket command - Manage Scoop buckets
 * Main dispatcher for bucket subcommands
 */

import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { error, log } from "src/utils/logger.ts";
import * as add from "./add.ts";
import * as known from "./known.ts";
import * as list from "./list.ts";
import * as remove from "./remove.ts";
import * as unused from "./unused.ts";
import * as update from "./update.ts";

/**
 * Show bucket command help
 */
function showHelp(): void {
    log(`
Usage: swb bucket <subcommand> [options]

Manage Scoop buckets - repositories containing app manifests.

Subcommands:
  list        List installed buckets
  add         Add a new bucket
  remove      Remove a bucket (alias: rm)
  known       List all known buckets
  update      Update bucket(s) from remote
  unused      Find buckets without installed apps

Options:
  --help     Show help for a subcommand
  --global   Use global scope instead of user scope

Examples:
  swb bucket list
  swb bucket add extras
  swb bucket remove extras --force
  swb bucket known
  swb bucket update
  swb bucket update extras --changelog
  swb bucket unused

Run 'swb bucket <subcommand> --help' for more information on a subcommand.
`);
}

/**
 * Main bucket command handler
 */
async function handler(args: ParsedArgs): Promise<number> {
    const subcommand = args.args[0];

    // Show help if no subcommand or --help flag
    if (!subcommand || args.global.help) {
        showHelp();
        return 0;
    }

    // Remove subcommand from args before passing to subcommand handler
    const subArgs: ParsedArgs = {
        ...args,
        args: args.args.slice(1),
    };

    // Route to subcommand handlers
    switch (subcommand) {
        case "list":
        case "ls":
            return list.handler(subArgs);

        case "add":
            return add.handler(subArgs);

        case "remove":
        case "rm":
            return remove.handler(subArgs);

        case "known":
            return known.handler(subArgs);

        case "update":
            return update.handler(subArgs);

        case "unused":
            return unused.handler(subArgs);

        default:
            error(`Unknown subcommand: '${subcommand}'`);
            log("");
            showHelp();
            return 1;
    }
}

export const definition: CommandDefinition = {
    name: "bucket",
    description: "Manage Scoop buckets",
    handler,
};
