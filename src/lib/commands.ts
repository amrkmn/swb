/**
 * Command registry for all available CLI commands.
 * This module centralizes command imports and provides a registry for the CLI system.
 */

import type { CommandDefinition } from "./parser.ts";

// Import all command definitions
import { definition as configCommand } from "../commands/config.ts";
import { definition as infoCommand } from "../commands/info.ts";
import { definition as listCommand } from "../commands/list.ts";
import { definition as prefixCommand } from "../commands/prefix.ts";
import { definition as whichCommand } from "../commands/which.ts";

// Static command registry for easy access and bundling
export const commandRegistry: Record<string, CommandDefinition> = {
    config: configCommand,
    info: infoCommand,
    list: listCommand,
    prefix: prefixCommand,
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