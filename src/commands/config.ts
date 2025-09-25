import { mkdir, readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import type { CommandDefinition, ParsedArgs } from "../lib/parser.ts";
import { error, log } from "../utils/logger.ts";

// Types
interface ConfigObject {
    [key: string]: any;
}

// Utility functions
function coerceValue(value: string): any {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value === "null") return null;
    if (value === "undefined") return undefined;

    const num = Number(value);
    if (!isNaN(num) && value.trim() !== "") {
        return num;
    }

    return value;
}

function getHomeDir(): string {
    return homedir();
}

function getConfigPath(): string {
    return join(getHomeDir(), ".config", "scoop", "config.json");
}

async function loadConfig(): Promise<ConfigObject> {
    try {
        const configPath = getConfigPath();
        const content = await readFile(configPath, "utf-8");
        return JSON.parse(content);
    } catch {
        return {};
    }
}

async function saveConfig(config: ConfigObject): Promise<void> {
    const configPath = getConfigPath();
    const configDir = join(getHomeDir(), ".config", "scoop");

    try {
        await mkdir(configDir, { recursive: true });
        await writeFile(configPath, JSON.stringify(config, null, 2));
    } catch (error) {
        throw new Error(
            `Failed to save config: ${error instanceof Error ? error.message : String(error)}`
        );
    }
}

function printAll(config: ConfigObject): void {
    if (Object.keys(config).length === 0) {
        log("No configuration values set.");
        return;
    }

    for (const [key, value] of Object.entries(config)) {
        log(`${key}: ${value}`);
    }
}

function printValue(value: any): void {
    log(JSON.stringify(value));
}

// New style command definition
export const definition: CommandDefinition = {
    name: "config",
    description: "Get/Set/Remove Scoop-compatible configuration",
    arguments: [
        {
            name: "name",
            description: "Configuration key name (or 'rm' to remove)",
            required: false,
        },
        {
            name: "value",
            description: "Configuration value to set (or key to remove if name is 'rm')",
            required: false,
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const cfg = await loadConfig();
            const [name, value] = args.args;

            // No args: print all
            if (!name) {
                printAll(cfg);
                return 0;
            }

            // Remove: rm <name>
            if (name === "rm") {
                const key = value;
                if (!key) {
                    error("Missing key to remove");
                    return 1;
                }
                if (!(key in cfg)) {
                    log(`'${key}' is not set`);
                    return 1;
                }
                delete (cfg as any)[key];
                await saveConfig(cfg);
                log(`'${key}' has been removed`);
                return 0;
            }

            // Get one: <name>
            if (name && value == null) {
                const key = name;
                if (!(key in cfg)) {
                    log(`'${key}' is not set`);
                    return 1;
                }
                printValue((cfg as any)[key]);
                return 0;
            }

            // Set: <name> <value>
            if (name && value != null) {
                const key = name;
                const coerced = coerceValue(String(value));
                (cfg as any)[key] = coerced;
                await saveConfig(cfg);
                log(`'${key}' has been set to '${String(coerced)}'`);
                return 0;
            }

            error("Invalid usage for config");
            return 1;
        } catch (err) {
            error(String(err instanceof Error ? err.message : err));
            return 1;
        }
    },
};
