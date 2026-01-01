import { describe, test, expect, mock } from "bun:test";
import { definition } from "src/commands/prefix.ts";
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

describe("prefix command", () => {
    describe("command definition", () => {
        test("should have correct name", () => {
            expect(definition.name).toBe("prefix");
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
                command: "prefix",
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

        test("should return error when app is not installed", async () => {
            mock.module("src/lib/apps.ts", () => ({
                resolveAppPrefix: mock(() => null),
            }));

            const args: ParsedArgs = {
                command: "prefix",
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

        test("should return app prefix for installed app", async () => {
            const mockPrefix = "C:\\Users\\test\\scoop\\apps\\test-app\\current";

            mock.module("src/lib/apps.ts", () => ({
                resolveAppPrefix: mock(() => mockPrefix),
            }));

            const args: ParsedArgs = {
                command: "prefix",
                args: ["test-app"],
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

        test("should use global scope when --global flag is provided", async () => {
            const mockPrefix = "C:\\ProgramData\\scoop\\apps\\test-app\\current";
            const resolveAppPrefixMock = mock(() => mockPrefix);

            mock.module("src/lib/apps.ts", () => ({
                resolveAppPrefix: resolveAppPrefixMock,
            }));

            const args: ParsedArgs = {
                command: "prefix",
                args: ["test-app"],
                flags: { global: true },
                global: {
                    help: false,
                    version: false,
                    verbose: false,
                    global: true,
                },
            };

            const result = await definition.handler(args);

            expect(result).toBe(0);
        });

        test("should fallback to global scope if not found in user scope", async () => {
            const mockPrefix = "C:\\ProgramData\\scoop\\apps\\test-app\\current";
            let callCount = 0;

            mock.module("src/lib/apps.ts", () => ({
                resolveAppPrefix: mock((app: string, scope: string) => {
                    callCount++;
                    if (callCount === 1 && scope === "user") return null;
                    if (callCount === 2 && scope === "global") return mockPrefix;
                    return null;
                }),
            }));

            const args: ParsedArgs = {
                command: "prefix",
                args: ["test-app"],
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
