/**
 * Bucket info worker - Gather bucket metadata in parallel
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as git from "src/utils/git";
import type { InstallScope } from "src/utils/paths";
import { resolveScoopPaths } from "src/utils/paths";

declare var self: Worker;

export interface BucketInfoJob {
    name: string;
    scope: InstallScope;
}

export interface BucketInfoResult {
    name: string;
    source: string;
    updated: string;
    manifests: number;
}

export interface BucketInfoResponse {
    type: "result" | "error";
    data?: BucketInfoResult;
    error?: string;
}

function getBucketPath(name: string, scope: InstallScope): string {
    const paths = resolveScoopPaths(scope);
    return join(paths.buckets, name);
}

function getBucketManifestCount(bucketPath: string): number {
    try {
        // Try bucket/ subdirectory first (standard structure)
        const bucketSubDir = join(bucketPath, "bucket");
        if (existsSync(bucketSubDir)) {
            const files = readdirSync(bucketSubDir);
            return files.filter(f => f.endsWith(".json")).length;
        }

        // Fallback to root directory (legacy/simple buckets)
        const files = readdirSync(bucketPath);
        return files.filter(f => f.endsWith(".json")).length;
    } catch {
        return 0;
    }
}

self.onmessage = async (event: MessageEvent<BucketInfoJob>) => {
    const { name, scope } = event.data;

    try {
        const bucketPath = getBucketPath(name, scope);
        const source = (await git.getRemoteUrl(bucketPath)) || "unknown";
        const lastCommit = await git.getLastCommitDate(bucketPath);
        const updated = lastCommit ? lastCommit.toISOString().split("T")[0] : "unknown";
        const manifests = getBucketManifestCount(bucketPath);

        const result: BucketInfoResult = {
            name,
            source,
            updated,
            manifests,
        };

        const response: BucketInfoResponse = {
            type: "result",
            data: result,
        };

        self.postMessage(response);
    } catch (err) {
        const response: BucketInfoResponse = {
            type: "error",
            error: err instanceof Error ? err.message : String(err),
        };

        self.postMessage(response);
    }
};
