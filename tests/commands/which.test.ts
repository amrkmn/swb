import { describe, test, expect, mock, beforeEach } from "bun:test";
import { WhichCommand } from "src/commands/which/index";
import { createMockContext } from "../test-utils";

describe("which command", () => {
    let command: WhichCommand;
    let context: ReturnType<typeof createMockContext>;

    beforeEach(() => {
        command = new WhichCommand();
        context = createMockContext();
    });

    test("should list paths found", async () => {
        context.services.shims.findExecutable = mock(() => Promise.resolve(["/path/to/git.exe"]));

        const args = { command: "git" };
        const flags = { global: false, g: false };

        const result = await command.run(context, args, flags);

        expect(result).toBe(0);
        expect(context.logger.log).toHaveBeenCalledWith("/path/to/git.exe");
    });

    test("should error if not found", async () => {
        context.services.shims.findExecutable = mock(() => Promise.resolve([]));

        const args = { command: "nonexistent" };
        const flags = { global: false, g: false };

        const result = await command.run(context, args, flags);

        expect(result).toBe(1);
        expect(context.logger.error).toHaveBeenCalled();
    });
});
