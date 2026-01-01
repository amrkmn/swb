import { describe, test, expect, mock } from "bun:test";
import { definition } from "src/commands/cleanup.ts";
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

describe("cleanup command", () => {
    describe("command definition", () => {
        test("should have correct name", () => {
            expect(definition.name).toBe("cleanup");
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
            expect(definition.arguments?.[0].required).toBe(false);
            expect(definition.arguments?.[0].variadic).toBe(true);
        });

        test("should have options for all and cache", () => {
            expect(definition.options).toBeDefined();
            expect(definition.options?.length).toBeGreaterThan(0);

            const allOption = definition.options?.find(opt => opt.flags.includes("all"));
            expect(allOption).toBeDefined();

            const cacheOption = definition.options?.find(opt => opt.flags.includes("cache"));
            expect(cacheOption).toBeDefined();
        });
    });

    describe("handler", () => {
        test("should return error when no app specified and --all not used", async () => {
            const args: ParsedArgs = {
                command: "cleanup",
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

        test("should clean up all apps when --all flag is used", async () => {
            const mockApps = [
                { name: "app1", version: "1.0.0", scope: "user", appDir: "/path/app1" },
                { name: "app2", version: "2.0.0", scope: "user", appDir: "/path/app2" },
            ];

            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => mockApps),
            }));

            mock.module("src/lib/commands/cleanup.ts", () => ({
                cleanupApp: mock(() => ({
                    app: "app1",
                    scope: "user",
                    oldVersions: [],
                    failedVersions: [],
                    cacheFiles: [],
                    freedSpace: 0,
                })),
                displayCleanupResults: mock(() => {}),
            }));

            const args: ParsedArgs = {
                command: "cleanup",
                args: [],
                flags: { all: true },
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

        test("should clean up all apps when * is used", async () => {
            const mockApps = [
                { name: "app1", version: "1.0.0", scope: "user", appDir: "/path/app1" },
            ];

            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => mockApps),
            }));

            mock.module("src/lib/commands/cleanup.ts", () => ({
                cleanupApp: mock(() => ({
                    app: "app1",
                    scope: "user",
                    oldVersions: [],
                    failedVersions: [],
                    cacheFiles: [],
                    freedSpace: 0,
                })),
                displayCleanupResults: mock(() => {}),
            }));

            const args: ParsedArgs = {
                command: "cleanup",
                args: ["*"],
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

        test("should clean up specific app", async () => {
            const mockApps = [
                { name: "test-app", version: "1.0.0", scope: "user", appDir: "/path/test-app" },
            ];

            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => mockApps),
            }));

            mock.module("src/lib/commands/cleanup.ts", () => ({
                cleanupApp: mock(() => ({
                    app: "app1",
                    scope: "user",
                    oldVersions: [],
                    failedVersions: [],
                    cacheFiles: [],
                    freedSpace: 0,
                })),
                displayCleanupResults: mock(() => {}),
            }));

            const args: ParsedArgs = {
                command: "cleanup",
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

        test("should return error for non-existent app", async () => {
            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => []),
            }));

            const args: ParsedArgs = {
                command: "cleanup",
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

        test("should handle --cache flag", async () => {
            const mockApps = [
                { name: "test-app", version: "1.0.0", scope: "user", appDir: "/path/test-app" },
            ];

            const cleanupAppMock = mock(() => ({
                app: "test-app",
                scope: "user",
                oldVersions: [],
                failedVersions: [],
                cacheFiles: ["test-app#0.9.0.zip"],
                freedSpace: 2048000,
            }));

            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => mockApps),
            }));

            mock.module("src/lib/commands/cleanup.ts", () => ({
                cleanupApp: cleanupAppMock,
                displayCleanupResults: mock(() => {}),
            }));

            const args: ParsedArgs = {
                command: "cleanup",
                args: ["test-app"],
                flags: { cache: true },
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

        test("should clean up multiple apps", async () => {
            const mockApps = [
                { name: "app1", version: "1.0.0", scope: "user", appDir: "/path/app1" },
                { name: "app2", version: "2.0.0", scope: "user", appDir: "/path/app2" },
            ];

            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => mockApps),
            }));

            mock.module("src/lib/commands/cleanup.ts", () => ({
                cleanupApp: mock(() => ({
                    app: "app1",
                    scope: "user",
                    oldVersions: [],
                    failedVersions: [],
                    cacheFiles: [],
                    freedSpace: 0,
                })),
                displayCleanupResults: mock(() => {}),
            }));

            const args: ParsedArgs = {
                command: "cleanup",
                args: ["app1", "app2"],
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

        test("should handle verbose flag", async () => {
            const mockApps = [
                { name: "test-app", version: "1.0.0", scope: "user", appDir: "/path/test-app" },
            ];

            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => mockApps),
            }));

            const displayCleanupResultsMock = mock(() => {});

            mock.module("src/lib/commands/cleanup.ts", () => ({
                cleanupApp: mock(() => ({
                    app: "test-app",
                    scope: "user",
                    oldVersions: ["0.9.0"],
                    failedVersions: [],
                    cacheFiles: [],
                    freedSpace: 1024000,
                })),
                displayCleanupResults: displayCleanupResultsMock,
            }));

            const args: ParsedArgs = {
                command: "cleanup",
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
