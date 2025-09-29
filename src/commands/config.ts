import { coerceValue, loadConfig, printAll, printValue, saveConfig } from "src/lib/commands/config";
import { CommandDefinition, ParsedArgs } from "src/lib/parser";
import { error, log } from "src/utils/logger";

// New style command definition
export const definition: CommandDefinition = {
    name: "config",
    description: "Manage Scoop's configuration settings",
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
