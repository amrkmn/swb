/**
 * Multi-worker parallel search implementation.
 * Spawns workers to scan buckets in parallel for fast search performance.
 */

import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { resolveScoopPaths, type InstallScope } from "../paths";
import type { WorkerSearchMessage, WorkerResponse, WorkerSearchResult } from "./worker";

/**
 * Get the worker URL - handles both dev (.ts) and bundled (.js) contexts
 */
function getWorkerUrl(): string {
    // In dev mode, import.meta.url ends with .ts
    if (import.meta.url.endsWith(".ts")) {
        return new URL("./worker.ts", import.meta.url).href;
    }
    // In bundled mode, worker is at lib/search/worker.js relative to cli.js
    return new URL("./lib/search/worker.js", import.meta.url).href;
}

export interface ParallelSearchResult {
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

/**
 * Find all buckets across both scopes
 */
function findAllBuckets(): BucketInfo[] {
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
export async function parallelSearch(
    query: string,
    options: {
        caseSensitive?: boolean;
        bucket?: string;
    } = {}
): Promise<ParallelSearchResult[]> {
    const buckets = findAllBuckets();

    // Filter by bucket if specified
    const targetBuckets = options.bucket
        ? buckets.filter(b => b.name.toLowerCase() === options.bucket!.toLowerCase())
        : buckets;

    if (targetBuckets.length === 0) {
        return [];
    }

    // Spawn workers for each bucket
    const workerPromises = targetBuckets.map(bucket => {
        return new Promise<{ bucket: BucketInfo; results: WorkerSearchResult[] }>(
            (resolve, reject) => {
                const worker = new Worker(getWorkerUrl());

                const timeout = setTimeout(() => {
                    worker.terminate();
                    resolve({ bucket, results: [] });
                }, 10000); // 10 second timeout

                worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
                    clearTimeout(timeout);
                    worker.terminate();

                    if (event.data.type === "error") {
                        resolve({ bucket, results: [] });
                    } else {
                        resolve({ bucket, results: event.data.results || [] });
                    }
                };

                worker.onerror = () => {
                    clearTimeout(timeout);
                    worker.terminate();
                    resolve({ bucket, results: [] });
                };

                const message: WorkerSearchMessage = {
                    type: "search",
                    bucketName: bucket.name,
                    bucketDir: bucket.bucketDir.replace(/\\/g, "/"),
                    query,
                    caseSensitive: options.caseSensitive || false,
                };

                worker.postMessage(message);
            }
        );
    });

    // Wait for all workers to complete
    const workerResults = await Promise.all(workerPromises);

    // Combine and format results
    const results: ParallelSearchResult[] = [];

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
 * Get the number of available buckets
 */
export function getBucketCount(): number {
    return findAllBuckets().length;
}
