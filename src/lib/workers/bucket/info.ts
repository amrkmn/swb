/**
 * Bucket info worker - Gather bucket metadata in parallel
 */

import { getBucketManifestCount, getBucketPath } from "src/lib/buckets.ts";
import * as git from "src/lib/git.ts";
import type { InstallScope } from "src/lib/paths.ts";

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
