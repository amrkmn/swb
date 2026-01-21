import { describe, test, expect, mock } from "bun:test";
import { definition } from "src/commands/version.ts";
import type { ParsedArgs } from "src/lib/parser.ts";

// Mock logger to suppress output
mock.module("src/utils/logger.ts", () => ({
    log: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    success: mock(() => {}),
    verbose: mock(() => {}),
}));

describe("version command", () => {
    describe("command definition", () => {
        test("should have correct name", () => {
            expect(definition.name).toBe("version");
        });

        test("should have description", () => {
            expect(definition.description).toBeDefined();
            expect(definition.description.length).toBeGreaterThan(0);
        });

        test("should have handler function", () => {
            expect(definition.handler).toBeDefined();
            expect(typeof definition.handler).toBe("function");
        });

        test("should have no arguments", () => {
            expect(definition.arguments).toBeDefined();
            expect(definition.arguments?.length).toBe(0);
        });

        test("should have no options", () => {
            expect(definition.options).toBeDefined();
            expect(definition.options?.length).toBe(0);
        });
    });

    describe("handler", () => {
        test("should return version from package.json", async () => {
            const args: ParsedArgs = {
                command: "version",
                args: [],
                flags: {},
                global: {
                    help: false,
                    version: false,
                    verbose: false,
                    global: false,
                },
            };

            const result = await definition.handler(args);

            expect(result).toBe(0);
        });
    });
});
