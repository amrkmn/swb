/**
 * Bucket update worker - Update buckets in parallel
 */

import { pull, isGitRepo, getCommitsSinceRemote } from "src/lib/git.ts";
import { getBucketPath } from "src/lib/buckets.ts";
import type { InstallScope } from "src/lib/paths.ts";

declare var self: Worker;

export interface BucketUpdateJob {
    name: string;
    scope: InstallScope;
    showChangelog: boolean;
}

export interface BucketUpdateResult {
    name: string;
    status: "updated" | "up-to-date" | "failed";
    commits?: string[];
    error?: string;
}

export interface BucketUpdateResponse {
    type: "result" | "error";
    data?: BucketUpdateResult;
    error?: string;
}

self.onmessage = async (event: MessageEvent<BucketUpdateJob>) => {
    const { name, scope, showChangelog } = event.data;

    try {
        const bucketPath = getBucketPath(name, scope);

        // Check if it's a git repository
        if (!(await isGitRepo(bucketPath))) {
            const response: BucketUpdateResponse = {
                type: "result",
                data: {
                    name,
                    status: "failed",
                    error: "Not a git repository",
                },
            };
            self.postMessage(response);
            return;
        }

        // Get commits before pulling (always check to determine status)
        const commitsBefore = await getCommitsSinceRemote(bucketPath);

        // Pull updates
        await pull(bucketPath);

        const result: BucketUpdateResult = {
            name,
            status: commitsBefore.length > 0 ? "updated" : "up-to-date",
            commits: showChangelog ? commitsBefore : undefined,
        };

        const response: BucketUpdateResponse = {
            type: "result",
            data: result,
        };

        self.postMessage(response);
    } catch (err) {
        const response: BucketUpdateResponse = {
            type: "result",
            data: {
                name,
                status: "failed",
                error: err instanceof Error ? err.message : String(err),
            },
        };

        self.postMessage(response);
    }
};
