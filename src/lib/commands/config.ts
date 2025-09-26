import { mkdir, readFile, writeFile } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { green } from "src/utils/colors";
import { log } from "src/utils/logger";

export interface ConfigObject {
    [key: string]: any;
}

export function coerceValue(value: string): any {
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

export function getHomeDir(): string {
    return homedir();
}

export function getConfigPath(): string {
    return join(getHomeDir(), ".config", "scoop", "config.json");
}

export async function loadConfig(): Promise<ConfigObject> {
    try {
        const configPath = getConfigPath();
        const content = await readFile(configPath, "utf-8");
        return JSON.parse(content);
    } catch {
        return {};
    }
}

export async function saveConfig(config: ConfigObject): Promise<void> {
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

export function printAll(config: ConfigObject): void {
    if (Object.keys(config).length === 0) {
        log("No configuration values set.");
        return;
    }

    for (const [key, value] of Object.entries(config)) {
        log(`${green(key)}: ${value}`);
    }
}

export function printValue(value: any): void {
    log(JSON.stringify(value));
}
