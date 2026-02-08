import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Service } from "src/core/Context";
import { getWorkerUrl } from "src/utils/workers";
import {
    getGlobalScoopRoot,
    getUserScoopRoot,
    resolveScoopPaths,
    type InstallScope,
} from "src/utils/paths";
import type {
    BucketUpdateJob,
    BucketUpdateResponse,
    BucketUpdateResult,
} from "src/workers/bucket/update";
import type { BucketInfoJob, BucketInfoResponse, BucketInfoResult } from "src/workers/bucket/info";

// Types from existing worker implementation
export interface WorkerSearchMessage {
    type: "search";
    bucketName: string;
    bucketDir: string;
    query: string;
    caseSensitive: boolean;
}

export interface WorkerSearchResult {
    name: string;
    version: string;
    description: string;
    bucket: string;
    binaries: string[];
}

export interface WorkerResponse {
    type: "result" | "error";
    results?: WorkerSearchResult[];
    error?: string;
}

export interface SearchResult {
    name: string;
    version: string;
    description: string;
    bucket: string;
    binaries: string[];
    scope: InstallScope;
    isInstalled: boolean;
}

interface BucketInfo {
    name: string;
    bucketDir: string;
    scope: InstallScope;
}

// Status Types
export interface InstalledAppInfo {
    name: string;
    version: string;
    scope: "user" | "global";
    currentPath: string;
    bucket?: string;
}

export interface BucketLocation {
    name: string;
    bucketDir: string;
    scope: "user" | "global";
}

export interface StatusWorkerMessage {
    type: "check";
    apps: InstalledAppInfo[];
    buckets: BucketLocation[];
    scoopPath: string;
    globalScoopPath: string;
}

export interface AppStatusResult {
    name: string;
    installedVersion: string | null;
    latestVersion: string | null;
    scope: "user" | "global";
    outdated: boolean;
    failed: boolean;
    deprecated: boolean;
    removed: boolean;
    held: boolean;
    missingDeps: string[];
    info: string[];
}

export interface StatusWorkerResponse {
    type: "results" | "progress" | "error";
    results?: AppStatusResult[];
    progress?: number;
    error?: string;
    checkTime?: number;
}

export class WorkerService extends Service {
    /**
     * Find all buckets across both scopes
     * (Ported from src/lib/search/parallel.ts)
     */
    private findAllBuckets(): BucketInfo[] {
        const buckets: BucketInfo[] = [];
        const scopes: InstallScope[] = ["user", "global"];

        for (const scope of scopes) {
            const paths = resolveScoopPaths(scope);
            const bucketsRoot = paths.buckets;

            if (!existsSync(bucketsRoot)) continue;

            try {
                const dirs = readdirSync(bucketsRoot, { withFileTypes: true });

                for (const dir of dirs) {
                    if (!dir.isDirectory()) continue;

                    const bucketRootDir = join(bucketsRoot, dir.name);
                    const bucketSubDir = join(bucketRootDir, "bucket");

                    // Prefer bucket subdirectory if it exists and has JSON files
                    if (existsSync(bucketSubDir)) {
                        try {
                            const files = readdirSync(bucketSubDir, { withFileTypes: true });
                            const hasJsonFiles = files.some(
                                f => f.isFile() && f.name.endsWith(".json")
                            );
                            if (hasJsonFiles) {
                                buckets.push({ name: dir.name, bucketDir: bucketSubDir, scope });
                                continue;
                            }
                        } catch {
                            // Fall through to root dir
                        }
                    }

                    // Use root directory
                    buckets.push({ name: dir.name, bucketDir: bucketRootDir, scope });
                }
            } catch {
                // Skip inaccessible bucket roots
            }
        }

        return buckets;
    }

    /**
     * Search buckets in parallel using workers
     */
    async search(
        query: string,
        options: {
            caseSensitive?: boolean;
            bucket?: string;
            installedApps?: string[];
        } = {},
        onProgress?: (completed: number, total: number, bucketName: string) => void
    ): Promise<SearchResult[]> {
        const buckets = this.findAllBuckets();

        // Filter by bucket if specified
        const targetBuckets = options.bucket
            ? buckets.filter(b => b.name.toLowerCase() === options.bucket!.toLowerCase())
            : buckets;

        if (targetBuckets.length === 0) {
            return [];
        }

        const total = targetBuckets.length;
        let completed = 0;

        // Spawn workers for each bucket
        const workerPromises = targetBuckets.map(bucket => {
            return new Promise<{ bucket: BucketInfo; results: WorkerSearchResult[] }>(
                (resolve, reject) => {
                    const worker = new Worker(getWorkerUrl("search"));

                    const timeout = setTimeout(() => {
                        worker.terminate();
                        completed++;
                        onProgress?.(completed, total, bucket.name);
                        resolve({ bucket, results: [] });
                    }, 60000); // 60 second timeout for cold starts

                    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
                        clearTimeout(timeout);
                        worker.terminate();
                        completed++;
                        onProgress?.(completed, total, bucket.name);

                        if (event.data.type === "error") {
                            resolve({ bucket, results: [] });
                        } else {
                            resolve({ bucket, results: event.data.results || [] });
                        }
                    };

                    worker.onerror = () => {
                        clearTimeout(timeout);
                        worker.terminate();
                        completed++;
                        onProgress?.(completed, total, bucket.name);
                        resolve({ bucket, results: [] });
                    };

                    const message: WorkerSearchMessage = {
                        type: "search",
                        bucketName: bucket.name,
                        bucketDir: bucket.bucketDir.replace(/\\/g, "/"),
                        query,
                        caseSensitive: options.caseSensitive || false,
                        installedApps: options.installedApps,
                    };

                    worker.postMessage(message);
                }
            );
        });

        // Wait for all workers to complete
        const workerResults = await Promise.all(workerPromises);

        // Combine and format results
        const results: SearchResult[] = [];

        for (const { bucket, results: bucketResults } of workerResults) {
            for (const result of bucketResults) {
                results.push({
                    name: result.name,
                    version: result.version,
                    description: result.description,
                    bucket: result.bucket,
                    binaries: result.binaries,
                    scope: bucket.scope,
                    isInstalled: false, // Will be updated by caller
                });
            }
        }

        return results;
    }

    /**
     * Run status check in parallel using workers
     */
    async checkStatus(
        apps: InstalledAppInfo[],
        onProgress?: (count: number) => void
    ): Promise<AppStatusResult[]> {
        if (apps.length === 0) return [];

        const buckets = this.findAllBuckets();
        const worker = new Worker(getWorkerUrl("status"));

        return new Promise(resolve => {
            const results: AppStatusResult[] = [];

            worker.onmessage = (event: MessageEvent<StatusWorkerResponse>) => {
                const data = event.data;

                if (data.type === "progress") {
                    onProgress?.(data.progress || 0);
                } else if (data.type === "results") {
                    worker.terminate();
                    resolve(data.results || []);
                } else if (data.type === "error") {
                    worker.terminate();
                    // In case of error, return what we have or empty
                    resolve([]);
                }
            };

            worker.onerror = () => {
                worker.terminate();
                resolve([]);
            };

            const msg: StatusWorkerMessage = {
                type: "check",
                apps,
                buckets: buckets.map(b => ({
                    name: b.name,
                    bucketDir: b.bucketDir,
                    scope: b.scope,
                })),
                scoopPath: getUserScoopRoot(),
                globalScoopPath: getGlobalScoopRoot(),
            };

            worker.postMessage(msg);
        });
    }

    /**
     * Update a bucket using a worker
     */
    async updateBucket(
        name: string,
        scope: InstallScope,
        showChangelog: boolean
    ): Promise<BucketUpdateResult> {
        return new Promise(resolve => {
            const worker = new Worker(getWorkerUrl("bucket/update"));

            worker.onmessage = (event: MessageEvent<BucketUpdateResponse>) => {
                const response = event.data;
                worker.terminate();

                if (response.type === "result" && response.data) {
                    resolve(response.data);
                } else {
                    resolve({
                        name,
                        status: "failed",
                        error: response.error || "Unknown worker error",
                    });
                }
            };

            worker.onerror = err => {
                worker.terminate();
                resolve({
                    name,
                    status: "failed",
                    error: err.message,
                });
            };

            const job: BucketUpdateJob = { name, scope, showChangelog };
            worker.postMessage(job);
        });
    }

    /**
     * Get bucket info using a worker
     */
    async getBucketInfo(name: string, scope: InstallScope): Promise<BucketInfoResult> {
        return new Promise((resolve, reject) => {
            const worker = new Worker(getWorkerUrl("bucket/info"));

            worker.onmessage = (event: MessageEvent<BucketInfoResponse>) => {
                const response = event.data;
                worker.terminate();

                if (response.type === "result" && response.data) {
                    resolve(response.data);
                } else {
                    reject(new Error(response.error || "Unknown worker error"));
                }
            };

            worker.onerror = err => {
                worker.terminate();
                reject(new Error(err.message));
            };

            const job: BucketInfoJob = { name, scope };
            worker.postMessage(job);
        });
    }
}
