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

        const commitBeforePull = await git.getCommitHash("HEAD", bucketPath);
        if (!commitBeforePull) {
            throw new Error("Unable to read current commit hash");
        }

        await git.pull(bucketPath);

        const commitAfterPull = await git.getCommitHash("HEAD", bucketPath);
        if (!commitAfterPull) {
            throw new Error("Unable to read updated commit hash");
        }

        const hasUpdates = commitBeforePull !== commitAfterPull;
        let commits: string[] | undefined;

        if (showChangelog && hasUpdates) {
            const commitLog = await git.getCommitsSince(commitBeforePull, "format:%s", bucketPath);
            commits = commitLog
                .split("\n")
                .map(line => line.trim())
                .filter(Boolean);
        }

        const result: BucketUpdateResult = {
            name,
            status: hasUpdates ? "updated" : "up-to-date",
            commits,
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
