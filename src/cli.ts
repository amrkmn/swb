#!/usr/bin/env bun

/**
 * Scoop With Bun (swb) CLI entry point
 */

import { runCLI } from "./lib/cli.ts";

// Run the CLI with command line arguments
const exitCode = await runCLI(process.argv.slice(2));
process.exit(exitCode);
