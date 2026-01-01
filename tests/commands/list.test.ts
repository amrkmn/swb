import { describe, test, expect, mock } from "bun:test";
import { definition } from "src/commands/list.ts";
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

describe("list command", () => {
    describe("command definition", () => {
        test("should have correct name", () => {
            expect(definition.name).toBe("list");
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
            expect(definition.arguments?.[0].name).toBe("query");
            expect(definition.arguments?.[0].required).toBe(false);
        });

        test("should have json option", () => {
            expect(definition.options).toBeDefined();
            expect(definition.options?.length).toBeGreaterThan(0);
            const jsonOption = definition.options?.find(opt => opt.flags.includes("json"));
            expect(jsonOption).toBeDefined();
        });
    });

    describe("handler", () => {
        test("should handle empty app list", async () => {
            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => []),
            }));

            const args: ParsedArgs = {
                command: "list",
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

        test("should list apps without filter", async () => {
            const mockApps = [
                { name: "app1", version: "1.0.0" },
                { name: "app2", version: "2.0.0" },
            ];

            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => mockApps),
            }));

            mock.module("src/lib/commands/list.ts", () => ({
                getAppsListInfo: mock((apps: any[]) => apps),
                displayAppsList: mock(() => {}),
                displayAppsListJson: mock(() => {}),
                displayListSummary: mock(() => {}),
            }));

            const args: ParsedArgs = {
                command: "list",
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

        test("should list apps with query filter", async () => {
            const mockApps = [{ name: "app1", version: "1.0.0" }];

            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock((query?: string) => mockApps),
            }));

            mock.module("src/lib/commands/list.ts", () => ({
                getAppsListInfo: mock((apps: any[]) => apps),
                displayAppsList: mock(() => {}),
                displayAppsListJson: mock(() => {}),
                displayListSummary: mock(() => {}),
            }));

            const args: ParsedArgs = {
                command: "list",
                args: ["app1"],
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

        test("should output JSON format when --json flag is provided", async () => {
            const mockApps = [{ name: "app1", version: "1.0.0" }];

            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => mockApps),
            }));

            const displayAppsListJsonMock = mock(() => {});

            mock.module("src/lib/commands/list.ts", () => ({
                getAppsListInfo: mock((apps: any[]) => apps),
                displayAppsList: mock(() => {}),
                displayAppsListJson: displayAppsListJsonMock,
                displayListSummary: mock(() => {}),
            }));

            const args: ParsedArgs = {
                command: "list",
                args: [],
                flags: { json: true },
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
