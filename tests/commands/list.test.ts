import { describe, test, expect, mock, beforeEach } from "bun:test";
import { ListCommand } from "src/commands/list/index";
import { createMockContext } from "../test-utils";

describe("list command", () => {
    let command: ListCommand;
    let context: ReturnType<typeof createMockContext>;

    beforeEach(() => {
        command = new ListCommand();
        context = createMockContext();
    });

    test("should list installed apps", async () => {
        context.services.apps.listInstalled = mock(() => [
            { name: "app1", version: "1.0.0", scope: "user" } as any,
            { name: "app2", version: "2.0.0", scope: "global" } as any,
        ]);

        const result = await command.run(context, {}, { json: false });

        expect(result).toBe(0);
        expect(context.services.apps.listInstalled).toHaveBeenCalled();
    });

    test("should output json", async () => {
        context.services.apps.listInstalled = mock(() => [
            { name: "app1", version: "1.0.0", scope: "user" } as any,
        ]);

        const result = await command.run(context, {}, { json: true });

        expect(result).toBe(0);
        expect(context.logger.log).toHaveBeenCalled();
        // verify JSON output
        const logCall = (context.logger.log as any).mock.calls[0][0];
        expect(logCall).toContain("app1");
    });
});
