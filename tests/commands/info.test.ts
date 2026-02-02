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

    test("should display app info", async () => {
        context.services.manifests.findAllManifests = mock(() => [
            {
                source: "installed",
                scope: "user",
                app: "test-app",
                filePath: "/path/to/manifest.json",
                manifest: { version: "1.0.0", description: "Test App" },
            } as any,
        ]);

        context.services.manifests.readManifestFields = mock(() => ({
            name: "test-app",
            version: "1.0.0",
            description: "Test App",
            homepage: "http://example.com",
            license: "MIT",
            source: "bucket",
        }));

        const args = { app: "test-app" };
        const flags = { verbose: false, v: false };

        const result = await command.run(context, args, flags);

        expect(result).toBe(0);
        expect(context.services.manifests.findAllManifests).toHaveBeenCalledWith("test-app");
    });

    test("should error if app not found", async () => {
        context.services.manifests.findAllManifests = mock(() => []);

        const args = { app: "nonexistent" };
        const flags = { verbose: false, v: false };

        const result = await command.run(context, args, flags);

        expect(result).toBe(1);
        expect(context.logger.error).toHaveBeenCalled();
    });
});
