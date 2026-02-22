import { describe, test, expect, mock, beforeEach } from "bun:test";
import { StatusCommand } from "src/commands/status/index";
import { createMockContext } from "../test-utils";

describe("status command", () => {
    let command: StatusCommand;
    let context: ReturnType<typeof createMockContext>;

    beforeEach(() => {
        command = new StatusCommand();
        context = createMockContext();
    });

    test("should report everything up to date", async () => {
        context.services.apps.listInstalled = mock(() => [
            { name: "app1", version: "1.0.0", scope: "user" } as any,
        ]);

        context.services.buckets.checkScoopStatus = mock(() => Promise.resolve(false));
        context.services.buckets.checkBucketsStatus = mock(() => Promise.resolve(false));

        context.services.workers.checkStatus = mock(() =>
            Promise.resolve([
                { name: "app1", outdated: false, failed: false, missingDeps: [], info: [] } as any,
            ])
        );

        const result = await command.run(context, {}, { local: false, verbose: false });

        expect(result).toBe(0);
        expect(context.logger.success).toHaveBeenCalledWith(
            "All packages are okay and up to date."
        );
    });

    test("should report outdated apps", async () => {
        context.services.apps.listInstalled = mock(() => [
            { name: "app1", version: "1.0.0", scope: "user" } as any,
        ]);

        context.services.buckets.checkScoopStatus = mock(() => Promise.resolve(false));
        context.services.buckets.checkBucketsStatus = mock(() => Promise.resolve(false));

        context.services.workers.checkStatus = mock(() =>
            Promise.resolve([
                {
                    name: "app1",
                    outdated: true,
                    installedVersion: "1.0.0",
                    latestVersion: "2.0.0",
                    missingDeps: [],
                    info: [],
                } as any,
            ])
        );

        const result = await command.run(context, {}, { local: false, verbose: false });

        expect(result).toBe(0);
        // Should log updates
        expect(context.logger.log).toHaveBeenCalledWith(
            expect.stringContaining("potential updates")
        );
    });
});
