import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { green } from "src/utils/colors";
import { z } from "zod";

const ConfigArgs = z.object({
    name: z.string().optional(),
    value: z.string().optional(),
});

const ConfigFlags = z.object({});

export class ConfigCommand extends Command<typeof ConfigArgs, typeof ConfigFlags> {
    name = "config";
    description = "Manage Scoop's configuration settings";
    argsSchema = ConfigArgs;
    flagsSchema = ConfigFlags;

    examples = ["swb config proxy localhost:8080", "swb config rm proxy", "swb config debug true"];

    async run(ctx: Context, args: z.infer<typeof ConfigArgs>, flags: z.infer<typeof ConfigFlags>) {
        const { logger, services } = ctx;
        const configService = services.config;
        const { name, value } = args;

        // 1. List all (no args)
        if (!name) {
            const cfg = await configService.load();
            if (Object.keys(cfg).length === 0) {
                logger.log("No configuration values set.");
                return 0;
            }
            for (const [k, v] of Object.entries(cfg)) {
                logger.log(`${green(k)}: ${v}`);
            }
            return 0;
        }

        // 2. Remove (rm <key>)
        if (name === "rm") {
            const key = value;
            if (!key) {
                logger.error("Missing key to remove");
                return 1;
            }
            const deleted = await configService.delete(key);
            if (!deleted) {
                logger.log(`'${key}' is not set`);
                return 1;
            }
            logger.log(`'${key}' has been removed`);
            return 0;
        }

        // 3. Get value (<key>)
        if (value === undefined) {
            const key = name;
            const val = await configService.get(key);
            if (val === undefined) {
                logger.log(`'${key}' is not set`);
                return 1;
            }
            logger.log(JSON.stringify(val));
            return 0;
        }

        // 4. Set value (<key> <value>)
        const key = name;
        const coercedValue = configService.coerceValue(value);
        await configService.set(key, coercedValue);
        logger.log(`'${key}' has been set to '${String(coercedValue)}'`);

        return 0;
    }
}
