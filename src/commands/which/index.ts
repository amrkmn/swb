import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { z } from "zod";

const WhichArgs = z.object({
    command: z.string().min(1, "Command name is required"),
});

const WhichFlags = z.object({
    global: z.boolean().default(false),
});

export class WhichCommand extends Command<typeof WhichArgs, typeof WhichFlags> {
    name = "which";
    description = "Locate a shim/executable (similar to 'where')";
    argsSchema = WhichArgs;
    flagsSchema = WhichFlags;

    flagAliases = {
        g: "global",
    };

    async run(ctx: Context, args: z.infer<typeof WhichArgs>, _flags: z.infer<typeof WhichFlags>) {
        const { logger, services } = ctx;
        const shimService = services.shims;

        const paths = await shimService.findExecutable(args.command);

        if (paths.length > 0) {
            paths.forEach(p => logger.log(p));
            return 0;
        } else {
            logger.error(`Could not find '${args.command}' in shims or PATH.`);
            return 1;
        }
    }
}
