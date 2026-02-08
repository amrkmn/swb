import path from "node:path";
import * as git from "src/utils/git";
import { resolveScoopPaths, type InstallScope } from "src/utils/paths";

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

function getBucketPath(name: string, scope: InstallScope): string {
    const paths = resolveScoopPaths(scope);
    return path.join(paths.buckets, name);
}

self.onmessage = async (event: MessageEvent<BucketUpdateJob>) => {
    const { name, scope, showChangelog } = event.data;

    try {
        const bucketPath = getBucketPath(name, scope);

        // Check if it's a git repository
        if (!(await git.isGitRepo(bucketPath))) {
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

        await git.fetch(bucketPath);

        const commitsBefore = showChangelog ? await git.getCommitsSinceRemote(bucketPath) : [];
        const hasUpdates = showChangelog
            ? commitsBefore.length > 0
            : await git.hasRemoteUpdates(bucketPath);

        // Pull updates
        if (hasUpdates) await git.pull(bucketPath);

        const result: BucketUpdateResult = {
            name,
            status: hasUpdates ? "updated" : "up-to-date",
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
