import { describe, test, expect, mock, beforeEach } from "bun:test";
import { ConfigCommand } from "src/commands/config/index";
import { createMockContext } from "../test-utils";

describe("config command", () => {
    let command: ConfigCommand;
    let context: ReturnType<typeof createMockContext>;

    beforeEach(() => {
        command = new ConfigCommand();
        context = createMockContext();

        // Mock ConfigService methods
        context.services.config.load = mock(() => Promise.resolve({ proxy: "http://proxy" }));
        context.services.config.get = mock(() => Promise.resolve("http://proxy"));
        context.services.config.set = mock(() => Promise.resolve());
        context.services.config.delete = mock(() => Promise.resolve(true));
        context.services.config.coerceValue = mock(v => v);
    });

    test("should list config when no args", async () => {
        const result = await command.run(context, {}, {});
        expect(result).toBe(0);
        expect(context.services.config.load).toHaveBeenCalled();
    });

    test("should get value", async () => {
        const args = { name: "proxy" };
        const result = await command.run(context, args, {});
        expect(result).toBe(0);
        expect(context.services.config.get).toHaveBeenCalledWith("proxy");
    });

    test("should set value", async () => {
        const args = { name: "proxy", value: "http://new-proxy" };
        const result = await command.run(context, args, {});
        expect(result).toBe(0);
        expect(context.services.config.set).toHaveBeenCalledWith("proxy", "http://new-proxy");
    });

    test("should remove value with rm", async () => {
        const args = { name: "rm", value: "proxy" };
        const result = await command.run(context, args, {});
        expect(result).toBe(0);
        expect(context.services.config.delete).toHaveBeenCalledWith("proxy");
    });
});
