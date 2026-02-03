import { describe, test, expect, mock, beforeEach } from "bun:test";
import { InfoCommand } from "src/commands/info/index";
import { createMockContext } from "../test-utils";

describe("info command", () => {
    let command: InfoCommand;
    let context: ReturnType<typeof createMockContext>;

    beforeEach(() => {
        command = new InfoCommand();
        context = createMockContext();
    });

    test("should display app info with both versions", async () => {
        context.services.manifests.findAllManifests = mock(() => [
            {
                source: "installed",
                scope: "user",
                app: "test-app",
                filePath: "/path/to/manifest.json",
                manifest: { version: "1.0.0", description: "Test App" },
            } as any,
            {
                source: "bucket",
                scope: "user",
                bucket: "main",
                app: "test-app",
                filePath: "/buckets/main/test-app.json",
                manifest: {
                    version: "1.1.0",
                    description: "Test App",
                    license: "MIT",
                    homepage: "http://example.com",
                },
            } as any,
        ]);

        context.services.manifests.findManifestPair = mock(() => ({
            installed: {
                source: "installed",
                scope: "user",
                app: "test-app",
                filePath: "/path/to/manifest.json",
                manifest: { version: "1.0.0", description: "Test App" },
            } as any,
            bucket: {
                source: "bucket",
                scope: "user",
                bucket: "main",
                app: "test-app",
                filePath: "/buckets/main/test-app.json",
                manifest: {
                    version: "1.1.0",
                    description: "Test App",
                    license: "MIT",
                    homepage: "http://example.com",
                },
            } as any,
        }));

        context.services.manifests.readManifestPair = mock(() => ({
            name: "test-app",
            version: "1.1.0",
            installedVersion: "1.0.0",
            latestVersion: "1.1.0",
            description: "Test App",
            homepage: "http://example.com",
            license: "MIT",
            source: "main",
            updateAvailable: true,
        }));

        const args = { app: "test-app" };
        const flags = {};

        const result = await command.run(context, args, flags);

        expect(result).toBe(0);
        expect(context.services.manifests.findAllManifests).toHaveBeenCalledWith("test-app");
        expect(context.services.manifests.findManifestPair).toHaveBeenCalledWith("test-app");
    });

    test("should error if app not found", async () => {
        context.services.manifests.findAllManifests = mock(() => []);

        const args = { app: "nonexistent" };
        const flags = {};

        const result = await command.run(context, args, flags);

        expect(result).toBe(1);
        expect(context.logger.error).toHaveBeenCalled();
    });
});
