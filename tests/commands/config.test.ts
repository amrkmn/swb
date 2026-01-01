import { describe, test, expect, beforeEach, mock } from "bun:test";
import { definition } from "src/commands/config.ts";
import type { ParsedArgs } from "src/lib/parser.ts";
import * as configLib from "src/lib/commands/config";

// Mock the config module
const mockConfig = {
    proxy: "http://proxy.example.com",
    last_update: "2024-01-01",
    aria2_enabled: true,
};

// Mock logger to suppress output
mock.module("src/utils/logger.ts", () => ({
    log: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    success: mock(() => {}),
    verbose: mock(() => {}),
}));

describe("config command", () => {
    beforeEach(() => {
        // Reset mocks before each test
        mock.restore();
    });

    describe("command definition", () => {
        test("should have correct name", () => {
            expect(definition.name).toBe("config");
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
            expect(definition.arguments?.length).toBe(2);
            expect(definition.arguments?.[0].name).toBe("name");
            expect(definition.arguments?.[0].required).toBe(false);
            expect(definition.arguments?.[1].name).toBe("value");
            expect(definition.arguments?.[1].required).toBe(false);
        });
    });

    describe("handler", () => {
        test("should print all config when no args provided", async () => {
            const loadConfigMock = mock(() => Promise.resolve(mockConfig));
            const printAllMock = mock(() => {});

            mock.module("src/lib/commands/config", () => ({
                loadConfig: loadConfigMock,
                printAll: printAllMock,
                printValue: mock(() => {}),
                saveConfig: mock(() => Promise.resolve()),
                coerceValue: mock((v: string) => v),
            }));

            const args: ParsedArgs = {
                command: "config",
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
            expect(loadConfigMock).toHaveBeenCalled();
            expect(printAllMock).toHaveBeenCalledWith(mockConfig);
        });

        test("should get specific config value", async () => {
            const loadConfigMock = mock(() => Promise.resolve(mockConfig));
            const printValueMock = mock(() => {});

            mock.module("src/lib/commands/config", () => ({
                loadConfig: loadConfigMock,
                printAll: mock(() => {}),
                printValue: printValueMock,
                saveConfig: mock(() => Promise.resolve()),
                coerceValue: mock((v: string) => v),
            }));

            const args: ParsedArgs = {
                command: "config",
                args: ["proxy"],
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
            expect(loadConfigMock).toHaveBeenCalled();
            expect(printValueMock).toHaveBeenCalledWith(mockConfig.proxy);
        });

        test("should return error for non-existent config key", async () => {
            const loadConfigMock = mock(() => Promise.resolve(mockConfig));

            mock.module("src/lib/commands/config", () => ({
                loadConfig: loadConfigMock,
                printAll: mock(() => {}),
                printValue: mock(() => {}),
                saveConfig: mock(() => Promise.resolve()),
                coerceValue: mock((v: string) => v),
            }));

            const args: ParsedArgs = {
                command: "config",
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

        test("should set config value", async () => {
            const loadConfigMock = mock(() => Promise.resolve(mockConfig));
            const saveConfigMock = mock(() => Promise.resolve());
            const coerceValueMock = mock((v: string) => v);

            mock.module("src/lib/commands/config", () => ({
                loadConfig: loadConfigMock,
                printAll: mock(() => {}),
                printValue: mock(() => {}),
                saveConfig: saveConfigMock,
                coerceValue: coerceValueMock,
            }));

            const args: ParsedArgs = {
                command: "config",
                args: ["proxy", "http://newproxy.com"],
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
            expect(loadConfigMock).toHaveBeenCalled();
            expect(saveConfigMock).toHaveBeenCalled();
            expect(coerceValueMock).toHaveBeenCalledWith("http://newproxy.com");
        });

        test("should remove config value with rm command", async () => {
            const loadConfigMock = mock(() => Promise.resolve({ ...mockConfig }));
            const saveConfigMock = mock(() => Promise.resolve());

            mock.module("src/lib/commands/config", () => ({
                loadConfig: loadConfigMock,
                printAll: mock(() => {}),
                printValue: mock(() => {}),
                saveConfig: saveConfigMock,
                coerceValue: mock((v: string) => v),
            }));

            const args: ParsedArgs = {
                command: "config",
                args: ["rm", "proxy"],
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
            expect(loadConfigMock).toHaveBeenCalled();
            expect(saveConfigMock).toHaveBeenCalled();
        });

        test("should return error when removing non-existent key", async () => {
            const loadConfigMock = mock(() => Promise.resolve(mockConfig));

            mock.module("src/lib/commands/config", () => ({
                loadConfig: loadConfigMock,
                printAll: mock(() => {}),
                printValue: mock(() => {}),
                saveConfig: mock(() => Promise.resolve()),
                coerceValue: mock((v: string) => v),
            }));

            const args: ParsedArgs = {
                command: "config",
                args: ["rm", "nonexistent"],
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

        test("should return error when rm has no key argument", async () => {
            const loadConfigMock = mock(() => Promise.resolve(mockConfig));

            mock.module("src/lib/commands/config", () => ({
                loadConfig: loadConfigMock,
                printAll: mock(() => {}),
                printValue: mock(() => {}),
                saveConfig: mock(() => Promise.resolve()),
                coerceValue: mock((v: string) => v),
            }));

            const args: ParsedArgs = {
                command: "config",
                args: ["rm"],
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
    });
});
