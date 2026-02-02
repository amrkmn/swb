import { describe, test, expect, mock, beforeEach } from "bun:test";
import { PrefixCommand } from "src/commands/prefix/index";
import { createMockContext } from "../test-utils";

describe("prefix command", () => {
    let command: PrefixCommand;
    let context: ReturnType<typeof createMockContext>;

    beforeEach(() => {
        command = new PrefixCommand();
        context = createMockContext();
    });

    test("should return prefix path", async () => {
        context.services.apps.getAppPrefix = mock(() => "/path/to/app");

        const args = { app: "test-app" };
        const flags = { global: false, g: false };

        const result = await command.run(context, args, flags);

        expect(result).toBe(0);
        expect(context.logger.log).toHaveBeenCalledWith("/path/to/app");
    });

    test("should error if app not found", async () => {
        context.services.apps.getAppPrefix = mock(() => null);

        const args = { app: "nonexistent" };
        const flags = { global: false, g: false };

        const result = await command.run(context, args, flags);

        expect(result).toBe(1);
        expect(context.logger.error).toHaveBeenCalled();
    });
});
