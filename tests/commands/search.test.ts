import { describe, test, expect, mock } from "bun:test";
import { definition } from "src/commands/search.ts";
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

describe("search command", () => {
    describe("command definition", () => {
        test("should have correct name", () => {
            expect(definition.name).toBe("search");
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
            expect(definition.arguments?.[0].required).toBe(true);
        });

        test("should have options for bucket, case-sensitive, and installed", () => {
            expect(definition.options).toBeDefined();
            expect(definition.options?.length).toBeGreaterThan(0);

            const bucketOption = definition.options?.find(opt => opt.flags.includes("bucket"));
            expect(bucketOption).toBeDefined();

            const caseSensitiveOption = definition.options?.find(opt =>
                opt.flags.includes("case-sensitive")
            );
            expect(caseSensitiveOption).toBeDefined();

            const installedOption = definition.options?.find(opt =>
                opt.flags.includes("installed")
            );
            expect(installedOption).toBeDefined();
        });
    });

    describe("handler", () => {
        test("should return error when query is not provided", async () => {
            const args: ParsedArgs = {
                command: "search",
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

        test("should search with basic query", async () => {
            const mockResults = [{ name: "test-app", bucket: "main", version: "1.0.0" }];

            mock.module("src/lib/search", () => ({
                getBucketCount: mock(() => 1),
            }));

            mock.module("src/lib/commands/search", () => ({
                searchBuckets: mock(() => Promise.resolve(mockResults)),
                formatResults: mock(() => {}),
            }));

            mock.module("src/utils/loader.ts", () => ({
                ProgressBar: mock(() => ({
                    start: mock(() => {}),
                    setProgress: mock(() => {}),
                    stop: mock(() => {}),
                })),
            }));

            const args: ParsedArgs = {
                command: "search",
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

        test("should apply case-sensitive flag", async () => {
            const mockResults: any[] = [];
            const searchBucketsMock = mock(() => Promise.resolve(mockResults));

            mock.module("src/lib/search", () => ({
                getBucketCount: mock(() => 1),
            }));

            mock.module("src/lib/commands/search", () => ({
                searchBuckets: searchBucketsMock,
                formatResults: mock(() => {}),
            }));

            mock.module("src/utils/loader.ts", () => ({
                ProgressBar: mock(() => ({
                    start: mock(() => {}),
                    setProgress: mock(() => {}),
                    stop: mock(() => {}),
                })),
            }));

            const args: ParsedArgs = {
                command: "search",
                args: ["Test"],
                flags: { "case-sensitive": true },
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

        test("should filter by bucket", async () => {
            const mockResults: any[] = [];
            const searchBucketsMock = mock(() => Promise.resolve(mockResults));

            mock.module("src/lib/search", () => ({
                getBucketCount: mock(() => 1),
            }));

            mock.module("src/lib/commands/search", () => ({
                searchBuckets: searchBucketsMock,
                formatResults: mock(() => {}),
            }));

            mock.module("src/utils/loader.ts", () => ({
                ProgressBar: mock(() => ({
                    start: mock(() => {}),
                    setProgress: mock(() => {}),
                    stop: mock(() => {}),
                })),
            }));

            const args: ParsedArgs = {
                command: "search",
                args: ["test"],
                flags: { bucket: "main" },
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

        test("should search only installed packages", async () => {
            const mockResults: any[] = [];
            const searchBucketsMock = mock(() => Promise.resolve(mockResults));

            mock.module("src/lib/search", () => ({
                getBucketCount: mock(() => 1),
            }));

            mock.module("src/lib/commands/search", () => ({
                searchBuckets: searchBucketsMock,
                formatResults: mock(() => {}),
            }));

            mock.module("src/utils/loader.ts", () => ({
                ProgressBar: mock(() => ({
                    start: mock(() => {}),
                    setProgress: mock(() => {}),
                    stop: mock(() => {}),
                })),
            }));

            const args: ParsedArgs = {
                command: "search",
                args: ["test"],
                flags: { installed: true },
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
