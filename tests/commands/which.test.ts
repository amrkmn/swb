import { describe, test, expect, mock } from "bun:test";
import { definition } from "src/commands/which.ts";
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

describe("which command", () => {
    describe("command definition", () => {
        test("should have correct name", () => {
            expect(definition.name).toBe("which");
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
            expect(definition.arguments?.[0].name).toBe("name");
            expect(definition.arguments?.[0].required).toBe(true);
        });
    });

    describe("handler", () => {
        test("should return error when executable name is not provided", async () => {
            const args: ParsedArgs = {
                command: "which",
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

        test("should find executable in shims", async () => {
            const mockPath = "C:\\Users\\test\\scoop\\shims\\test.exe";

            mock.module("src/lib/which.ts", () => ({
                findInShims: mock(() => [mockPath]),
                findInPATH: mock(() => []),
            }));

            mock.module("src/utils/commands.ts", () => ({
                whichCommand: mock(() => Promise.resolve("")),
            }));

            const args: ParsedArgs = {
                command: "which",
                args: ["test"],
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

        test("should find executable in PATH", async () => {
            const mockPath = "C:\\Windows\\System32\\test.exe";

            mock.module("src/lib/which.ts", () => ({
                findInShims: mock(() => []),
                findInPATH: mock(() => [mockPath]),
            }));

            mock.module("src/utils/commands.ts", () => ({
                whichCommand: mock(() => Promise.resolve("")),
            }));

            const args: ParsedArgs = {
                command: "which",
                args: ["test"],
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

        test("should prioritize shims over PATH", async () => {
            const shimPath = "C:\\Users\\test\\scoop\\shims\\test.exe";
            const pathPath = "C:\\Windows\\System32\\test.exe";

            mock.module("src/lib/which.ts", () => ({
                findInShims: mock(() => [shimPath]),
                findInPATH: mock(() => [pathPath]),
            }));

            mock.module("src/utils/commands.ts", () => ({
                whichCommand: mock(() => Promise.resolve("")),
            }));

            const args: ParsedArgs = {
                command: "which",
                args: ["test"],
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

        test("should return error when executable is not found", async () => {
            mock.module("src/lib/which.ts", () => ({
                findInShims: mock(() => []),
                findInPATH: mock(() => []),
            }));

            mock.module("src/utils/commands.ts", () => ({
                whichCommand: mock(() => Promise.resolve("")),
            }));

            const args: ParsedArgs = {
                command: "which",
                args: ["nonexistent"],
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

        test("should fallback to where.exe when not found in shims or PATH", async () => {
            const mockPath = "C:\\Program Files\\test\\test.exe";

            mock.module("src/lib/which.ts", () => ({
                findInShims: mock(() => []),
                findInPATH: mock(() => []),
            }));

            mock.module("src/utils/commands.ts", () => ({
                whichCommand: mock(() => Promise.resolve(mockPath)),
            }));

            const args: ParsedArgs = {
                command: "which",
                args: ["test"],
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

        test("should return multiple matches", async () => {
            const shimPath = "C:\\Users\\test\\scoop\\shims\\test.exe";
            const pathPath = "C:\\Windows\\System32\\test.exe";

            mock.module("src/lib/which.ts", () => ({
                findInShims: mock(() => [shimPath]),
                findInPATH: mock(() => [pathPath]),
            }));

            mock.module("src/utils/commands.ts", () => ({
                whichCommand: mock(() => Promise.resolve("")),
            }));

            const args: ParsedArgs = {
                command: "which",
                args: ["test"],
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
