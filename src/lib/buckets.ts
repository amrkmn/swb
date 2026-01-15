/**
 * Bucket utilities for managing Scoop buckets.
 * Provides functions to interact with bucket directories and manifests.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { resolveScoopPaths, type InstallScope } from "src/lib/paths.ts";

export interface BucketInfo {
    name: string;
    path: string;
    source?: string;
    updated?: Date;
    manifests: number;
}

/**
 * Get the buckets directory path for a given scope
 */
export function getBucketsPath(scope: InstallScope = "user"): string {
    return resolveScoopPaths(scope).buckets;
}

/**
 * Get the path to a specific bucket
 */
export function getBucketPath(name: string, scope: InstallScope = "user"): string {
    return path.join(getBucketsPath(scope), name);
}

/**
 * Check if a bucket exists
 */
export function bucketExists(name: string, scope: InstallScope = "user"): boolean {
    const bucketPath = getBucketPath(name, scope);
    return existsSync(bucketPath);
}

/**
 * Get all bucket names for a given scope
 */
export function getAllBuckets(scope: InstallScope = "user"): string[] {
    const bucketsPath = getBucketsPath(scope);

    if (!existsSync(bucketsPath)) {
        return [];
    }

    try {
        return readdirSync(bucketsPath).filter(name => {
            const fullPath = path.join(bucketsPath, name);
            try {
                const stats = statSync(fullPath);
                return stats.isDirectory();
            } catch {
                return false;
            }
        });
    } catch {
        return [];
    }
}

/**
 * Count JSON manifest files in a bucket directory
 */
export function getBucketManifestCount(bucketPath: string): number {
    if (!existsSync(bucketPath)) {
        return 0;
    }

    try {
        const bucketDir = path.join(bucketPath, "bucket");
        if (!existsSync(bucketDir)) {
            return 0;
        }

        const files = readdirSync(bucketDir);
        return files.filter(f => f.endsWith(".json")).length;
    } catch {
        return 0;
    }
}

/**
 * Get bucket info for a single bucket
 */
export async function getBucketInfo(
    name: string,
    scope: InstallScope = "user"
): Promise<BucketInfo | null> {
    const bucketPath = getBucketPath(name, scope);

    if (!existsSync(bucketPath)) {
        return null;
    }

    return {
        name,
        path: bucketPath,
        manifests: getBucketManifestCount(bucketPath),
    };
}

/**
 * Get all bucket information for a given scope
 */
export async function getAllBucketsInfo(scope: InstallScope = "user"): Promise<BucketInfo[]> {
    const bucketNames = getAllBuckets(scope);
    const buckets: BucketInfo[] = [];

    for (const name of bucketNames) {
        const info = await getBucketInfo(name, scope);
        if (info) {
            buckets.push(info);
        }
    }

    return buckets;
}
