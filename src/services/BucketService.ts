import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { Service } from "src/core/Context";
import * as git from "src/utils/git";
import { getAllKnownBuckets, getKnownBucket, type KnownBucket } from "src/utils/known-buckets";
import { resolveScoopPaths, type InstallScope } from "src/utils/paths";

export interface BucketInfo {
    name: string;
    path: string;
    source: string;
    updated: Date | null;
    manifests: number;
}

export interface ScoopAndBucketStatus {
    scoopOutdated: boolean;
    bucketsOutdated: boolean;
}

export class BucketService extends Service {
    /**
     * Get all bucket information for a given scope
     */
    async list(scope: InstallScope = "user"): Promise<BucketInfo[]> {
        const bucketNames = this.getAllBuckets(scope);

        // Fetch info in parallel
        const promises = bucketNames.map(name => this.getBucketInfo(name, scope));
        const results = await Promise.all(promises);

        return results.filter((b): b is BucketInfo => b !== null);
    }

    /**
     * Get list of known official buckets
     */
    known(): KnownBucket[] {
        return getAllKnownBuckets();
    }

    /**
     * Get URL for a known bucket
     */
    getKnownUrl(name: string): string | undefined {
        const url = getKnownBucket(name);
        return url === null ? undefined : url;
    }

    /**
     * Check if a bucket exists
     */
    exists(name: string, scope: InstallScope = "user"): boolean {
        return existsSync(this.getBucketPath(name, scope));
    }

    /**
     * Add a new bucket
     */
    async add(
        name: string,
        url: string,
        scope: InstallScope = "user",
        onProgress?: (progress: number) => void
    ): Promise<void> {
        const bucketPath = this.getBucketPath(name, scope);

        // Progress wrapper for git.clone
        const progressObj = onProgress
            ? {
                  start: () => {},
                  update: (p: number) => onProgress(p),
                  stop: () => {},
                  complete: () => onProgress(100),
              }
            : undefined;

        await git.clone(url, bucketPath, { progress: progressObj as any });
    }

    /**
     * Remove a bucket
     */
    remove(name: string, scope: InstallScope = "user"): void {
        const bucketPath = this.getBucketPath(name, scope);
        if (existsSync(bucketPath)) {
            rmSync(bucketPath, { recursive: true, force: true });
        }
    }

    /**
     * Check if Scoop app and buckets have updates
     */
    async checkStatus(local = false): Promise<ScoopAndBucketStatus> {
        if (local) {
            return { scoopOutdated: false, bucketsOutdated: false };
        }

        const scoopOutdated = await this.checkScoopStatus();
        const bucketsOutdated = await this.checkBucketsStatus();

        return { scoopOutdated, bucketsOutdated };
    }

    /**
     * Check if Scoop app itself needs updating
     */
    async checkScoopStatus(): Promise<boolean> {
        try {
            const scoopPath = join(resolveScoopPaths("user").root, "apps", "scoop", "current");
            return await this.checkGitRepoStatus(scoopPath);
        } catch {
            return false;
        }
    }

    /**
     * Check if any bucket has updates
     */
    async checkBucketsStatus(): Promise<boolean> {
        const scopes: InstallScope[] = ["user", "global"];
        const bucketPaths: string[] = [];

        for (const scope of scopes) {
            const buckets = this.getAllBuckets(scope);
            for (const bucketName of buckets) {
                bucketPaths.push(this.getBucketPath(bucketName, scope));
            }
        }

        if (bucketPaths.length === 0) {
            return false;
        }

        // Check all buckets in parallel, return true if any has updates
        const checks = bucketPaths.map(path => this.checkGitRepoStatus(path));
        const results = await Promise.allSettled(checks);

        return results.some(result => result.status === "fulfilled" && result.value === true);
    }

    /**
     * Check if a git repository has updates
     */
    private async checkGitRepoStatus(repoPath: string): Promise<boolean> {
        try {
            const gitPath = join(repoPath, ".git");

            if (!existsSync(gitPath)) {
                const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
                const stats = statSync(repoPath);
                return stats.mtimeMs < thirtyDaysAgo;
            }

            await git.fetch(repoPath);
            const branch = await git.getCurrentBranch(repoPath);
            if (!branch) return false;

            const count = await git.getCommitCount("HEAD", `origin/${branch}`, repoPath);
            return count > 0;
        } catch {
            return false;
        }
    }

    // ... existing private methods ...

    private getBucketsPath(scope: InstallScope = "user"): string {
        return resolveScoopPaths(scope).buckets;
    }

    private getBucketPath(name: string, scope: InstallScope = "user"): string {
        return join(this.getBucketsPath(scope), name);
    }

    private getAllBuckets(scope: InstallScope = "user"): string[] {
        const bucketsPath = this.getBucketsPath(scope);

        if (!existsSync(bucketsPath)) {
            return [];
        }

        try {
            return readdirSync(bucketsPath).filter(name => {
                const fullPath = join(bucketsPath, name);
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

    private getBucketManifestCount(bucketPath: string): number {
        if (!existsSync(bucketPath)) {
            return 0;
        }

        try {
            const bucketDir = join(bucketPath, "bucket");
            if (!existsSync(bucketDir)) {
                return 0;
            }

            const files = readdirSync(bucketDir);
            return files.filter(f => f.endsWith(".json")).length;
        } catch {
            return 0;
        }
    }

    private async getBucketInfo(
        name: string,
        scope: InstallScope = "user"
    ): Promise<BucketInfo | null> {
        const bucketPath = this.getBucketPath(name, scope);

        if (!existsSync(bucketPath)) {
            return null;
        }

        try {
            // Use worker service to fetch info in parallel
            const info = await this.ctx.services.workers.getBucketInfo(name, scope);

            return {
                name: info.name,
                path: bucketPath,
                source: info.source,
                updated: info.updated && info.updated !== "unknown" ? new Date(info.updated) : null,
                manifests: info.manifests,
            };
        } catch (err) {
            // Fallback or just return null?
            // If worker fails, we might want to log it or ignore
            // For list command, maybe just return what we can?
            // But if worker fails, something is wrong.
            // Let's try to mimic previous behavior which was robust

            // Previous behavior used git utils directly.
            // If that failed, it might return nulls or defaults.

            // Let's just return a basic object if we know it exists
            return {
                name,
                path: bucketPath,
                source: "unknown",
                updated: null,
                manifests: 0,
            };
        }
    }
}
