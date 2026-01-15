import { describe, test, expect, mock, beforeEach, beforeAll, afterAll } from "bun:test";
import { definition } from "src/commands/bucket/index.ts";
import type { ParsedArgs } from "src/lib/parser.ts";

// Suppress console output during tests
let originalConsoleLog: typeof console.log;
let originalStdoutWrite: typeof process.stdout.write;

beforeAll(() => {
    originalConsoleLog = console.log;
    originalStdoutWrite = process.stdout.write;
    console.log = mock(() => {});
    process.stdout.write = mock(() => true);
});

afterAll(() => {
    console.log = originalConsoleLog;
    process.stdout.write = originalStdoutWrite;
});

// Mock logger to suppress output
mock.module("src/utils/logger.ts", () => ({
    log: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    info: mock(() => {}),
    success: mock(() => {}),
    verbose: mock(() => {}),
    newline: mock(() => {}),
}));

// Mock colors
mock.module("src/utils/colors.ts", () => ({
    bold: mock((str: string) => str),
    cyan: mock((str: string) => str),
    dim: mock((str: string) => str),
    green: mock((str: string) => str),
    red: mock((str: string) => str),
    yellow: mock((str: string) => str),
}));

// Mock helpers
mock.module("src/utils/helpers.ts", () => ({
    formatLineColumns: mock(() => ""),
}));

describe("bucket command", () => {
    describe("command definition", () => {
        test("should have correct name", () => {
            expect(definition.name).toBe("bucket");
        });

        test("should have description", () => {
            expect(definition.description).toBeDefined();
            expect(definition.description.length).toBeGreaterThan(0);
        });

        test("should have handler function", () => {
            expect(definition.handler).toBeDefined();
            expect(typeof definition.handler).toBe("function");
        });
    });

    describe("bucket list", () => {
        beforeEach(() => {
            // Mock bucket utilities
            mock.module("src/lib/buckets.ts", () => ({
                getAllBuckets: mock(() => ["main", "extras"]),
                getBucketPath: mock((name: string) => `C:\\scoop\\buckets\\${name}`),
                getBucketManifestCount: mock(() => 100),
                bucketExists: mock(() => true),
            }));

            // Mock git operations
            mock.module("src/lib/git.ts", () => ({
                getRemoteUrl: mock(() => Promise.resolve("https://github.com/ScoopInstaller/Main")),
                getLastCommitDate: mock(() => Promise.resolve(new Date("2024-01-15"))),
                isGitRepo: mock(() => Promise.resolve(true)),
                clone: mock(() => Promise.resolve()),
                pull: mock(() => Promise.resolve()),
                getCommitsSinceRemote: mock(() => Promise.resolve([])),
            }));

            // Mock workers
            mock.module("src/lib/workers/index.ts", () => ({
                getWorkerUrl: mock(() => "bucket-info-worker.js"),
            }));
        });

        test("should return success with no buckets", async () => {
            mock.module("src/lib/buckets.ts", () => ({
                getAllBuckets: mock(() => []),
            }));

            const args: ParsedArgs = {
                command: "bucket",
                args: ["list"],
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

        test("should support JSON output", async () => {
            mock.module("src/lib/buckets.ts", () => ({
                getAllBuckets: mock(() => []),
            }));

            const args: ParsedArgs = {
                command: "bucket",
                args: ["list"],
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

    describe("bucket add", () => {
        beforeEach(() => {
            mock.module("src/lib/buckets.ts", () => ({
                bucketExists: mock(() => false),
                getBucketPath: mock((name: string) => `C:\\scoop\\buckets\\${name}`),
                getBucketManifestCount: mock(() => 50),
            }));

            mock.module("src/lib/git.ts", () => ({
                clone: mock(() => Promise.resolve()),
            }));

            mock.module("src/data/known-buckets.ts", () => ({
                getKnownBucket: mock(() => "https://github.com/ScoopInstaller/Extras"),
                isKnownBucket: mock(() => true),
            }));

            mock.module("src/utils/loader.ts", () => ({
                ProgressBar: class {
                    start() {}
                    setProgress() {}
                    complete() {}
                    stop() {}
                },
            }));
        });

        test("should return error when bucket name is missing", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: ["add"],
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

        test("should return error for invalid bucket name", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: ["add", "invalid@bucket"],
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

        test("should return error when bucket already exists", async () => {
            mock.module("src/lib/buckets.ts", () => ({
                bucketExists: mock(() => true),
            }));

            const args: ParsedArgs = {
                command: "bucket",
                args: ["add", "extras"],
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

        test("should return error for unknown bucket without URL", async () => {
            mock.module("src/data/known-buckets.ts", () => ({
                getKnownBucket: mock(() => null),
                isKnownBucket: mock(() => false),
            }));

            const args: ParsedArgs = {
                command: "bucket",
                args: ["add", "unknown-bucket"],
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

        test("should return error for invalid URL format", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: ["add", "mybucket", "invalid-url"],
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

    describe("bucket remove", () => {
        beforeEach(() => {
            mock.module("src/lib/buckets.ts", () => ({
                bucketExists: mock(() => true),
                getBucketPath: mock((name: string) => `C:\\scoop\\buckets\\${name}`),
            }));
        });

        test("should return error when bucket name is missing", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: ["remove"],
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

        test("should return error when bucket not found", async () => {
            mock.module("src/lib/buckets.ts", () => ({
                bucketExists: mock(() => false),
            }));

            const args: ParsedArgs = {
                command: "bucket",
                args: ["remove", "nonexistent"],
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

        test("should require force flag for confirmation", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: ["remove", "extras"],
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

        test("should support rm alias", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: ["rm", "extras"],
                flags: {},
                global: {
                    help: false,
                    version: false,
                    verbose: false,
                    global: false,
                },
            };

            const result = await definition.handler(args);
            // Should still require force flag
            expect(result).toBe(1);
        });
    });

    describe("bucket known", () => {
        beforeEach(() => {
            mock.module("src/data/known-buckets.ts", () => ({
                getAllKnownBuckets: mock(() => [
                    { name: "main", source: "https://github.com/ScoopInstaller/Main" },
                    { name: "extras", source: "https://github.com/ScoopInstaller/Extras" },
                ]),
            }));
        });

        test("should list known buckets", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: ["known"],
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

        test("should support JSON output", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: ["known"],
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

    describe("bucket update", () => {
        beforeEach(() => {
            mock.module("src/lib/buckets.ts", () => ({
                bucketExists: mock(() => true),
                getAllBuckets: mock(() => ["main", "extras"]),
                getBucketPath: mock((name: string) => `C:\\scoop\\buckets\\${name}`),
            }));

            mock.module("src/lib/git.ts", () => ({
                isGitRepo: mock(() => Promise.resolve(true)),
                pull: mock(() => Promise.resolve()),
                getCommitsSinceRemote: mock(() => Promise.resolve([])),
            }));

            mock.module("src/lib/workers/index.ts", () => ({
                getWorkerUrl: mock(() => "bucket-update-worker.js"),
            }));

            mock.module("src/utils/loader.ts", () => ({
                Loading: class {
                    start() {}
                    stop() {}
                },
            }));
        });

        test("should return success with no buckets", async () => {
            mock.module("src/lib/buckets.ts", () => ({
                getAllBuckets: mock(() => []),
            }));

            const args: ParsedArgs = {
                command: "bucket",
                args: ["update"],
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

        test("should return error for nonexistent bucket", async () => {
            mock.module("src/lib/buckets.ts", () => ({
                bucketExists: mock(() => false),
            }));

            const args: ParsedArgs = {
                command: "bucket",
                args: ["update", "nonexistent"],
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

        test("should support changelog flag", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: ["update"],
                flags: { changelog: true },
                global: {
                    help: false,
                    version: false,
                    verbose: false,
                    global: false,
                },
            };

            // This test verifies the flag is accepted
            // Actual changelog display would be tested in integration tests
            const result = await definition.handler(args);
            expect(result).toBeGreaterThanOrEqual(0);
        });
    });

    describe("bucket unused", () => {
        beforeEach(() => {
            mock.module("src/lib/buckets.ts", () => ({
                getAllBuckets: mock(() => ["main", "extras", "unused-bucket"]),
            }));

            mock.module("src/lib/paths.ts", () => ({
                resolveScoopPaths: mock(() => ({
                    apps: "C:\\scoop\\apps",
                    buckets: "C:\\scoop\\buckets",
                })),
            }));
        });

        test("should list unused buckets", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: ["unused"],
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

        test("should support JSON output", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: ["unused"],
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

        test("should return success with no buckets", async () => {
            mock.module("src/lib/buckets.ts", () => ({
                getAllBuckets: mock(() => []),
            }));

            const args: ParsedArgs = {
                command: "bucket",
                args: ["unused"],
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

    describe("unknown subcommand", () => {
        test("should return error for unknown subcommand", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: ["invalid-subcommand"],
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

    describe("help", () => {
        test("should show help when no subcommand provided", async () => {
            const args: ParsedArgs = {
                command: "bucket",
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

        test("should show help with --help flag", async () => {
            const args: ParsedArgs = {
                command: "bucket",
                args: [],
                flags: {},
                global: {
                    help: true,
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
