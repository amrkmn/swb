import { Command } from "src/core/Command";
import type { Context } from "src/core/Context";
import { dim } from "src/utils/colors";
import { z } from "zod";

const VersionArgs = z.object({});
const VersionFlags = z.object({});

export class VersionCommand extends Command<typeof VersionArgs, typeof VersionFlags> {
    name = "version";
    description = "Show version information";
    argsSchema = VersionArgs;
    flagsSchema = VersionFlags;

    async run(ctx: Context, _args: any, _flags: any) {
        const { logger } = ctx;

        logger.log(`v${ctx.version}`);

        return 0;
    }
}
