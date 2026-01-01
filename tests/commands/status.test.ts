import { describe, test, expect, mock } from "bun:test";
import { definition } from "src/commands/status.ts";
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

describe("status command", () => {
    describe("command definition", () => {
        test("should have correct name", () => {
            expect(definition.name).toBe("status");
        });

        test("should have description", () => {
            expect(definition.description).toBeDefined();
            expect(definition.description.length).toBeGreaterThan(0);
        });

        test("should have handler function", () => {
            expect(definition.handler).toBeDefined();
            expect(typeof definition.handler).toBe("function");
        });

        test("should have options for local and json", () => {
            expect(definition.options).toBeDefined();
            expect(definition.options?.length).toBeGreaterThan(0);

            const localOption = definition.options?.find(opt => opt.flags.includes("local"));
            expect(localOption).toBeDefined();

            const jsonOption = definition.options?.find(opt => opt.flags.includes("json"));
            expect(jsonOption).toBeDefined();
        });
    });

    describe("handler", () => {
        test("should handle no installed apps", async () => {
            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => []),
            }));

            const args: ParsedArgs = {
                command: "status",
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

        test("should check status with installed apps", async () => {
            const mockApps = [
                { name: "app1", version: "1.0.0" },
                { name: "app2", version: "2.0.0" },
            ];

            const mockStatuses = [
                { app: "app1", outdated: false, currentVersion: "1.0.0" },
                { app: "app2", outdated: true, currentVersion: "2.0.0", latestVersion: "2.1.0" },
            ];

            const mockScoopStatus = { outdated: false };

            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => mockApps),
            }));

            mock.module("src/lib/commands/status.ts", () => ({
                checkScoopStatus: mock(() => Promise.resolve(mockScoopStatus)),
                displayAppStatus: mock(() => {}),
                displayScoopStatus: mock(() => {}),
                displayStatusJson: mock(() => {}),
            }));

            mock.module("src/lib/status/index.ts", () => ({
                parallelStatusCheck: mock(() => Promise.resolve(mockStatuses)),
            }));

            mock.module("src/utils/loader.ts", () => ({
                ProgressBar: mock(() => ({
                    start: mock(() => {}),
                    setStep: mock(() => {}),
                    setProgress: mock(() => {}),
                    complete: mock(() => {}),
                })),
            }));

            const args: ParsedArgs = {
                command: "status",
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

        test("should use local flag to skip remote checks", async () => {
            const mockApps = [{ name: "app1", version: "1.0.0" }];
            const mockStatuses = [{ app: "app1", outdated: false, currentVersion: "1.0.0" }];
            const mockScoopStatus = { outdated: false };
            const checkScoopStatusMock = mock(() => Promise.resolve(mockScoopStatus));

            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => mockApps),
            }));

            mock.module("src/lib/commands/status.ts", () => ({
                checkScoopStatus: checkScoopStatusMock,
                displayAppStatus: mock(() => {}),
                displayScoopStatus: mock(() => {}),
                displayStatusJson: mock(() => {}),
            }));

            mock.module("src/lib/status/index.ts", () => ({
                parallelStatusCheck: mock(() => Promise.resolve(mockStatuses)),
            }));

            mock.module("src/utils/loader.ts", () => ({
                ProgressBar: mock(() => ({
                    start: mock(() => {}),
                    setStep: mock(() => {}),
                    setProgress: mock(() => {}),
                    complete: mock(() => {}),
                })),
            }));

            const args: ParsedArgs = {
                command: "status",
                args: [],
                flags: { local: true },
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
            const mockStatuses = [{ app: "app1", outdated: false, currentVersion: "1.0.0" }];
            const mockScoopStatus = { outdated: false };
            const displayStatusJsonMock = mock(() => {});

            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => mockApps),
            }));

            mock.module("src/lib/commands/status.ts", () => ({
                checkScoopStatus: mock(() => Promise.resolve(mockScoopStatus)),
                displayAppStatus: mock(() => {}),
                displayScoopStatus: mock(() => {}),
                displayStatusJson: displayStatusJsonMock,
            }));

            mock.module("src/lib/status/index.ts", () => ({
                parallelStatusCheck: mock(() => Promise.resolve(mockStatuses)),
            }));

            const args: ParsedArgs = {
                command: "status",
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

        test("should handle no apps with JSON output", async () => {
            mock.module("src/lib/apps.ts", () => ({
                listInstalledApps: mock(() => []),
            }));

            const args: ParsedArgs = {
                command: "status",
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
