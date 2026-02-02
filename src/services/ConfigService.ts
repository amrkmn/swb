import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Service } from "src/core/Context";

export interface ConfigObject {
    [key: string]: any;
}

export class ConfigService extends Service {
    private configPath: string;

    constructor(ctx: any) {
        super(ctx);
        this.configPath = join(homedir(), ".config", "scoop", "config.json");
    }

    async load(): Promise<ConfigObject> {
        try {
            const content = await readFile(this.configPath, "utf-8");
            return JSON.parse(content);
        } catch {
            return {};
        }
    }

    async save(config: ConfigObject): Promise<void> {
        const configDir = join(homedir(), ".config", "scoop");
        try {
            await mkdir(configDir, { recursive: true });
            await writeFile(this.configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            throw new Error(
                `Failed to save config: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async get(key: string): Promise<any> {
        const config = await this.load();
        return config[key];
    }

    async set(key: string, value: any): Promise<void> {
        const config = await this.load();
        config[key] = value;
        await this.save(config);
    }

    async delete(key: string): Promise<boolean> {
        const config = await this.load();
        if (!(key in config)) return false;

        delete config[key];
        await this.save(config);
        return true;
    }

    coerceValue(value: string): any {
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
}
