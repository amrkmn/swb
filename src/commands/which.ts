import { whichCommand } from "src/utils/commands.ts";
import type { CommandDefinition, ParsedArgs } from "../lib/parser.ts";
import { findInPATH, findInShims } from "../lib/which.ts";

// New style command definition
export const definition: CommandDefinition = {
    name: "which",
    description: "Locate an executable (shims first, then PATH)",
    arguments: [
        {
            name: "name",
            description: "Executable name to locate",
            required: true,
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const name = args.args[0];
            if (!name) {
                console.error("Executable name is required");
                return 1;
            }

            // 1) Shims
            let matches = findInShims(name);

            // 2) PATH
            if (matches.length === 0) {
                matches = findInPATH(name);
            } else {
                // Add PATH matches while keeping unique ordering
                const m2 = findInPATH(name);
                for (const p of m2) {
                    if (!matches.some(q => q.toLowerCase() === p.toLowerCase())) {
                        matches.push(p);
                    }
                }
            }

            // 3) Fallback to where.exe for robustness
            if (matches.length === 0) {
                try {
                    const result = await whichCommand(`where.exe ${name}`);
                    if (result) {
                        const lines = result
                            .split(/\r?\n/)
                            .map(s => s.trim())
                            .filter(Boolean);
                        for (const p of lines) {
                            if (!matches.some(q => q.toLowerCase() === p.toLowerCase())) {
                                matches.push(p);
                            }
                        }
                    }
                } catch {
                    // ignore
                }
            }

            if (matches.length === 0) {
                console.error(`'${name}' was not found`);
                return 1;
            }

            // Print primary match
            console.log(matches[0]);

            // Print alternates if any (Scoop shows others in PATH)
            if (matches.length > 1) {
                for (let i = 1; i < matches.length; i++) {
                    console.log(matches[i]);
                }
            }

            return 0;
        } catch (error) {
            console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
            return 1;
        }
    },
};
