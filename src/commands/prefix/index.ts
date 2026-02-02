import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { z } from "zod";

const PrefixArgs = z.object({
    app: z.string().min(1, "App name is required"),
});

const PrefixFlags = z.object({
    global: z.boolean().default(false),
});

export class PrefixCommand extends Command<typeof PrefixArgs, typeof PrefixFlags> {
    name = "prefix";
    description = "Returns the path to the specified app";
    argsSchema = PrefixArgs;
    flagsSchema = PrefixFlags;

    flagAliases = {
        g: "global",
    };

    async run(ctx: Context, args: z.infer<typeof PrefixArgs>, flags: z.infer<typeof PrefixFlags>) {
        const { logger, services } = ctx;
        const appsService = services.apps;
        const scope = flags.global ? "global" : "user";

        const path = appsService.getAppPrefix(args.app, scope);

        if (path) {
            logger.log(path);
            return 0;
        } else {
            logger.error(`App '${args.app}' not found`);
            return 1;
        }
    }
}
