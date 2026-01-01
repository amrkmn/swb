/**
 * Command registry for all available CLI commands.
 * This module centralizes command imports and provides a registry for the CLI system.
 */

import type { CommandDefinition } from "src/lib/parser.ts";

// Import all command definitions
import { definition as cleanupCommand } from "src/commands/cleanup.ts";
import { definition as configCommand } from "src/commands/config.ts";
import { definition as infoCommand } from "src/commands/info.ts";
import { definition as listCommand } from "src/commands/list.ts";
import { definition as prefixCommand } from "src/commands/prefix.ts";
import { definition as searchCommand } from "src/commands/search.ts";
import { definition as statusCommand } from "src/commands/status.ts";
import { definition as whichCommand } from "src/commands/which.ts";

// Static command registry for easy access and bundling
export const commandRegistry: Record<string, CommandDefinition> = {
    cleanup: cleanupCommand,
    config: configCommand,
    info: infoCommand,
    list: listCommand,
    prefix: prefixCommand,
    search: searchCommand,
    status: statusCommand,
    which: whichCommand,
};

// Get all available command names
export function getAvailableCommandNames(): string[] {
    return Object.keys(commandRegistry);
}

// Get a specific command definition
export function getCommandDefinition(name: string): CommandDefinition | undefined {
    return commandRegistry[name];
}

// Check if a command exists
export function hasCommand(name: string): boolean {
    return name in commandRegistry;
}
