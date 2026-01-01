import { describe, test, expect, mock } from "bun:test";
import { definition } from "src/commands/info.ts";
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

describe("info command", () => {
    describe("command definition", () => {
        test("should have correct name", () => {
            expect(definition.name).toBe("info");
        });

        test("should have description", () => {
            expect(definition.description).toBeDefined();
            expect(definition.description.length).toBeGreaterThan(0);
        });

        test("should have handler function", () => {
            expect(definition.handler).toBeDefined();
            expect(typeof definition.handler).toBe("function");
        });

        test("should have correct arguments", () => {
            expect(definition.arguments).toBeDefined();
            expect(definition.arguments?.length).toBe(1);
            expect(definition.arguments?.[0].name).toBe("app");
            expect(definition.arguments?.[0].required).toBe(true);
        });

        test("should have options array", () => {
            expect(definition.options).toBeDefined();
            expect(Array.isArray(definition.options)).toBe(true);
        });
    });

    describe("handler", () => {
        test("should return error when app name is not provided", async () => {
            const args: ParsedArgs = {
                command: "info",
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

            expect(result).toBe(1);
        });

        test("should handle app not found", async () => {
            mock.module("src/lib/manifests.ts", () => ({
                findAllManifests: mock(() => []),
            }));

            const args: ParsedArgs = {
                command: "info",
                args: ["nonexistent-app"],
                flags: {},
                global: {
                    help: false,
                    version: false,
                    verbose: false,
                    global: false,
                },
            };

            const result = await definition.handler(args);

            expect(result).toBe(1);
        });

        test("should handle verbose flag", async () => {
            const printInfoMock = mock(() => Promise.resolve());

            mock.module("src/lib/manifests.ts", () => ({
                findAllManifests: mock(() => [
                    {
                        name: "test-app",
                        source: "installed",
                        path: "/path/to/manifest",
                        manifest: {},
                    },
                ]),
            }));

            mock.module("src/lib/commands/info.ts", () => ({
                printInfo: printInfoMock,
            }));

            const args: ParsedArgs = {
                command: "info",
                args: ["test-app"],
                flags: { verbose: true },
                global: {
                    help: false,
                    version: false,
                    verbose: true,
                    global: false,
                },
            };

            const result = await definition.handler(args);

            expect(result).toBe(0);
        });
    });
});
