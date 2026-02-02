import { beforeEach, describe, expect, mock, test } from "bun:test";
import { CleanupCommand } from "src/commands/cleanup/index";
import { createMockContext } from "../test-utils";

describe("cleanup command", () => {
    let command: CleanupCommand;
    let context: ReturnType<typeof createMockContext>;

    beforeEach(() => {
        command = new CleanupCommand();
        context = createMockContext();
    });

    test("should cleanup single app", async () => {
        // Mock listInstalled to find app
        context.services.apps.listInstalled = mock(() => [
            { name: "test-app", scope: "user", bucket: "main" } as any,
        ]);

        // Mock cleanup service
        context.services.cleanup.cleanupApp = mock(
            () =>
                ({
                    app: "test-app",
                    scope: "user",
                    oldVersions: [{ version: "1.0.0", size: 100 }],
                    failedVersions: [],
                    cacheFiles: [],
                }) as any
        );

        const args = { app: "test-app" };
        const flags = {
            all: false,
            a: false,
            cache: false,
            k: false,
            global: false,
            g: false,
            verbose: false,
            v: false,
            "dry-run": false,
        };

        const result = await command.run(context, args, flags);

        expect(result).toBe(0);
        expect(context.services.cleanup.cleanupApp).toHaveBeenCalled();
    });

    test("should error if app not installed", async () => {
        context.services.apps.listInstalled = mock(() => []);

        const args = { app: "nonexistent" };
        const flags = {
            all: false,
            a: false,
            cache: false,
            k: false,
            global: false,
            g: false,
            verbose: false,
            v: false,
            "dry-run": false,
        };

        const result = await command.run(context, args, flags);

        expect(result).toBe(1);
        expect(context.logger.error).toHaveBeenCalled();
    });

    test("should cleanup all apps with --all flag", async () => {
        context.services.apps.listInstalled = mock(() => [
            { name: "app1", scope: "user" } as any,
            { name: "app2", scope: "user" } as any,
        ]);

        context.services.cleanup.cleanupApp = mock(
            name =>
                ({
                    app: name,
                    scope: "user",
                    oldVersions: [],
                    failedVersions: [],
                    cacheFiles: [],
                }) as any
        );

        const args = { app: undefined };
        const flags = {
            all: true,
            a: true,
            cache: false,
            k: false,
            global: false,
            g: false,
            verbose: false,
            v: false,
            "dry-run": false,
        };

        const result = await command.run(context, args, flags);

        expect(result).toBe(0);
        expect(context.services.cleanup.cleanupApp).toHaveBeenCalledTimes(2);
    });
});
