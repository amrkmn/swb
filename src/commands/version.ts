import type { CommandDefinition, ParsedArgs } from "src/lib/parser.ts";
import { log } from "src/utils/logger";

declare const SWB_VERSION: string | undefined;

async function getVersion(): Promise<string> {
    // Check if SWB_VERSION was injected during build
    if (typeof SWB_VERSION !== "undefined") {
        return SWB_VERSION;
    }

    // Fallback to reading from package.json (development mode)
    try {
        const pkgPath = new URL("../../package.json", import.meta.url);
        const pkg = await Bun.file(pkgPath).json();
        return pkg.version || "unknown";
    } catch {
        return "unknown";
    }
}

export const definition: CommandDefinition = {
    name: "version",
    description: "Show SWB version",
    arguments: [],
    options: [],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const version = await getVersion();
            log(version);
            return 0;
        } catch (err) {
            log("unknown");
            return 1;
        }
    },
};
