import { beforeEach, describe, expect, mock, test } from "bun:test";
import { BucketAddCommand } from "src/commands/bucket/add";
import { BucketCommand } from "src/commands/bucket/index";
import { BucketListCommand } from "src/commands/bucket/list";
import { createMockContext } from "../test-utils";

describe("bucket command", () => {
    let command: BucketCommand;
    let context: ReturnType<typeof createMockContext>;

    beforeEach(() => {
        command = new BucketCommand();
        context = createMockContext();
    });

    test("should be a group command", () => {
        expect(command.name).toBe("bucket");
        expect(command.subcommands.length).toBeGreaterThan(0);
    });

    test("should have list subcommand", () => {
        const listCmd = command.getSubcommand("list");
        expect(listCmd).toBeDefined();
        expect(listCmd).toBeInstanceOf(BucketListCommand);
    });

    describe("list subcommand", () => {
        let listCmd: BucketListCommand;

        beforeEach(() => {
            listCmd = new BucketListCommand();
        });

        test("should list buckets", async () => {
            const mockBuckets = [
                { name: "main", source: "http://github.com/main", manifests: 100 },
                { name: "extras", source: "http://github.com/extras", manifests: 50 },
            ];

            context.services.buckets.list = mock(() => Promise.resolve(mockBuckets as any));

            const result = await listCmd.run(context, {}, {});

            expect(result).toBe(0);
            expect(context.services.buckets.list).toHaveBeenCalled();
        });

        test("should handle empty buckets", async () => {
            context.services.buckets.list = mock(() => Promise.resolve([]));

            const result = await listCmd.run(context, {}, {});

            expect(result).toBe(0);
            expect(context.logger.warn).toHaveBeenCalledWith("No buckets installed."); // Update logic check
        });
    });

    describe("add subcommand", () => {
        let addCmd: BucketAddCommand;

        beforeEach(() => {
            addCmd = new BucketAddCommand();
        });

        test("should add known bucket", async () => {
            context.services.buckets.exists = mock(() => false);
            context.services.buckets.getKnownUrl = mock(() => "https://github.com/known/bucket");
            context.services.buckets.add = mock(() => Promise.resolve());

            const args = { name: "known-bucket" };
            const flags = { global: false };

            const result = await addCmd.run(context, args, flags);

            expect(result).toBe(0);
            expect(context.services.buckets.add).toHaveBeenCalled();
        });

        test("should fail if bucket exists", async () => {
            context.services.buckets.exists = mock(() => true);

            const args = { name: "existing" };
            const flags = { global: false };

            const result = await addCmd.run(context, args, flags);

            expect(result).toBe(1);
            expect(context.logger.error).toHaveBeenCalled();
        });
    });
});
