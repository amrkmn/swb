/**
 * Parallel status checking using workers.
 * Distributes app status checks across multiple workers for faster processing.
 */

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { type InstalledApp } from "src/lib/apps.ts";
import { resolveScoopPaths, type InstallScope } from "src/lib/paths.ts";
import type {
    InstalledAppInfo,
    BucketLocation,
    StatusWorkerMessage,
    StatusWorkerResponse,
    AppStatusResult,
} from "./worker.ts";

export type { AppStatusResult };

export interface StatusCheckOptions {
    onProgress?: (completed: number, total: number) => void;
}

/**
 * Get the worker URL (handles both dev and bundled modes)
 */
function getWorkerUrl(): string {
    // In dev mode, import.meta.url ends with .ts
    if (import.meta.url.endsWith(".ts")) {
        return new URL("./worker.ts", import.meta.url).href;
    }
    // In bundled mode, worker is at lib/status/worker.js relative to cli.js
    return new URL("./lib/status/worker.js", import.meta.url).href;
}

/**
 * Find all bucket directories across scopes
 */
function findAllBuckets(): BucketLocation[] {
    const buckets: BucketLocation[] = [];
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
 * Convert InstalledApp to worker-compatible format
 */
function toWorkerApp(app: InstalledApp): InstalledAppInfo {
    return {
        name: app.name,
        version: app.version || "",
        scope: app.scope,
        currentPath: app.currentPath || "",
        bucket: app.bucket,
    };
}

/**
 * Get optimal number of workers based on app count
 */
function getWorkerCount(appCount: number): number {
    // Use fewer workers for small batches
    if (appCount <= 5) return 1;
    if (appCount <= 15) return 2;
    if (appCount <= 30) return 3;
    return Math.min(4, Math.ceil(appCount / 10));
}

/**
 * Split apps into batches for workers
 */
function splitIntoBatches<T>(items: T[], batchCount: number): T[][] {
    const batches: T[][] = Array.from({ length: batchCount }, () => []);
    items.forEach((item, i) => {
        batches[i % batchCount].push(item);
    });
    return batches.filter(b => b.length > 0);
}

/**
 * Check status of all apps in parallel using workers
 */
export async function parallelStatusCheck(
    apps: InstalledApp[],
    options: StatusCheckOptions = {}
): Promise<AppStatusResult[]> {
    if (apps.length === 0) {
        return [];
    }

    const { onProgress } = options;
    const buckets = findAllBuckets();
    const userPaths = resolveScoopPaths("user");
    const globalPaths = resolveScoopPaths("global");
    const scoopPath = userPaths.root;
    const globalScoopPath = globalPaths.root;

    const workerCount = getWorkerCount(apps.length);
    const appBatches = splitIntoBatches(apps.map(toWorkerApp), workerCount);
    const totalApps = apps.length;

    // Track progress across all workers
    const workerProgress: number[] = new Array(appBatches.length).fill(0);

    // Spawn workers for each batch
    const workerPromises = appBatches.map((batch, workerIndex) => {
        return new Promise<AppStatusResult[]>((resolve, reject) => {
            const worker = new Worker(getWorkerUrl());

            const timeout = setTimeout(() => {
                worker.terminate();
                resolve([]);
            }, 30000); // 30 second timeout

            worker.onmessage = (event: MessageEvent<StatusWorkerResponse>) => {
                if (event.data.type === "progress") {
                    // Update this worker's progress
                    workerProgress[workerIndex] = event.data.progress || 0;

                    // Calculate total progress across all workers
                    if (onProgress) {
                        const totalCompleted = workerProgress.reduce((a, b) => a + b, 0);
                        onProgress(totalCompleted, totalApps);
                    }
                } else if (event.data.type === "results") {
                    clearTimeout(timeout);
                    worker.terminate();
                    resolve(event.data.results || []);
                } else if (event.data.type === "error") {
                    clearTimeout(timeout);
                    worker.terminate();
                    resolve([]);
                }
            };

            worker.onerror = () => {
                clearTimeout(timeout);
                worker.terminate();
                resolve([]);
            };

            const message: StatusWorkerMessage = {
                type: "check",
                apps: batch,
                buckets: buckets.map(b => ({
                    name: b.name,
                    bucketDir: b.bucketDir.replace(/\\/g, "/"),
                    scope: b.scope,
                })),
                scoopPath: scoopPath.replace(/\\/g, "/"),
                globalScoopPath: globalScoopPath.replace(/\\/g, "/"),
            };

            worker.postMessage(message);
        });
    });

    // Wait for all workers to complete
    const workerResults = await Promise.all(workerPromises);

    // Combine results
    const results: AppStatusResult[] = [];
    for (const batchResults of workerResults) {
        results.push(...batchResults);
    }

    // Sort by name for consistent output
    results.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));

    return results;
}
