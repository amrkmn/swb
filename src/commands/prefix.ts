import type { CommandDefinition, ParsedArgs } from "../lib/parser.ts";
import type { InstallScope } from "../lib/paths.ts";
import { resolveAppPrefix } from "../lib/apps.ts";

// New style command definition
export const definition: CommandDefinition = {
    name: "prefix",
    description: "Print the installation prefix (current version directory) of an app",
    arguments: [
        {
            name: "app",
            description: "App name",
            required: true,
        },
    ],
    options: [
        {
            flags: "-g, --global",
            description: "Use global scope",
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const app = args.args[0];
            if (!app) {
                console.error("App name is required");
                return 1;
            }

            // Check for global flag from args or global context
            const useGlobal = Boolean(args.flags.global || args.global.global);
            const preferScope: InstallScope = useGlobal ? "global" : "user";

            // Use true for returnCurrentPath to get the 'current' symlink path like Scoop
            let prefix = resolveAppPrefix(app, preferScope, true);
            if (!prefix && preferScope === "user") {
                // Fallback to global
                prefix = resolveAppPrefix(app, "global", true);
            }

            if (!prefix) {
                console.error(`'${app}' is not installed or has no current version`);
                return 1;
            }

            console.log(prefix);
            return 0;
        } catch (error) {
            console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
            return 1;
        }
    },
};
