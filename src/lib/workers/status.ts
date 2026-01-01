/**
 * Worker script for parallel app status checking.
 * Each worker checks the status of a batch of installed apps.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

declare var self: Worker;

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
    progress?: number; // Number of apps completed so far
    error?: string;
    checkTime?: number;
}

/**
 * Parse version string into comparable array
 */
function parseVersionString(version: string): number[] {
    const parts = version.split(/[.\-_+]/);
    const result: number[] = [];

    for (const part of parts) {
        const match = part.match(/^(\d+)/);
        if (match) {
            result.push(parseInt(match[1], 10));
        }
    }

    while (result.length < 4) {
        result.push(0);
    }

    return result.slice(0, 4);
}

/**
 * Compare two version arrays, returns > 0 if a > b
 */
function compareVersionArrays(a: number[], b: number[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const partA = a[i] || 0;
        const partB = b[i] || 0;
        if (partA !== partB) {
            return partA - partB;
        }
    }
    return 0;
}

/**
 * Compare versions, returns true if installed < latest (outdated)
 */
function isOutdated(installed: string | null, latest: string | null): boolean {
    if (!installed || !latest) return false;
    if (installed === latest) return false;

    const installedParts = parseVersionString(installed);
    const latestParts = parseVersionString(latest);

    return compareVersionArrays(installedParts, latestParts) < 0;
}

/**
 * Check if app is held by reading install.json
 */
function checkHeld(appName: string, scoopPath: string, globalScoopPath: string): boolean {
    // Check user scope
    const userInstallJson = join(scoopPath, "apps", appName, "current", "install.json");
    if (existsSync(userInstallJson)) {
        try {
            const content = JSON.parse(readFileSync(userInstallJson, "utf-8"));
            if (content.hold === true) {
                return true;
            }
        } catch {
            // Ignore parse errors
        }
    }

    // Check global scope
    const globalInstallJson = join(globalScoopPath, "apps", appName, "current", "install.json");
    if (existsSync(globalInstallJson)) {
        try {
            const content = JSON.parse(readFileSync(globalInstallJson, "utf-8"));
            if (content.hold === true) {
                return true;
            }
        } catch {
            // Ignore parse errors
        }
    }

    return false;
}

/**
 * Check if installation failed
 */
function checkFailed(app: InstalledAppInfo): boolean {
    if (!app.currentPath || !existsSync(app.currentPath)) {
        return true;
    }
    if (!app.version) {
        return true;
    }
    return false;
}

/**
 * Find latest version from all buckets
 */
function findLatestVersion(
    appName: string,
    buckets: BucketLocation[],
    installedBucket?: string
): { version: string | null; deprecated: boolean; removed: boolean } {
    let latestVersion: string | null = null;
    let highestVersionNumber = [0, 0, 0, 0];
    let deprecated = false;
    let foundInAnyBucket = false;

    // If we know the bucket, check it first
    if (installedBucket) {
        const bucket = buckets.find(b => b.name === installedBucket);
        if (bucket) {
            const filePath = join(bucket.bucketDir, `${appName}.json`);
            if (existsSync(filePath)) {
                foundInAnyBucket = true;
                if (bucket.bucketDir.includes("deprecated")) {
                    deprecated = true;
                }
                try {
                    const content = readFileSync(filePath, "utf8");
                    const manifest = JSON.parse(content);
                    if (manifest.version) {
                        return {
                            version: manifest.version,
                            deprecated,
                            removed: false,
                        };
                    }
                } catch {
                    // Skip invalid manifests
                }
            }
        }
    }

    // Fallback: check all buckets if not found in installed bucket or bucket unknown
    for (const bucket of buckets) {
        const filePath = join(bucket.bucketDir, `${appName}.json`);

        if (existsSync(filePath)) {
            foundInAnyBucket = true;

            if (bucket.bucketDir.includes("deprecated")) {
                deprecated = true;
            }

            try {
                const content = readFileSync(filePath, "utf8");
                const manifest = JSON.parse(content);

                if (manifest.version) {
                    const versionParts = parseVersionString(manifest.version);
                    if (compareVersionArrays(versionParts, highestVersionNumber) > 0) {
                        highestVersionNumber = versionParts;
                        latestVersion = manifest.version;
                    }
                }
            } catch {
                // Skip invalid manifests
            }
        }
    }

    return {
        version: latestVersion,
        deprecated,
        removed: !foundInAnyBucket,
    };
}

/**
 * Check status for a single app
 */
function checkAppStatus(
    app: InstalledAppInfo,
    buckets: BucketLocation[],
    scoopPath: string,
    globalScoopPath: string
): AppStatusResult | null {
    // Skip the 'scoop' app itself
    if (app.name === "scoop") {
        return null;
    }

    const {
        version: latestVersion,
        deprecated,
        removed,
    } = findLatestVersion(app.name, buckets, app.bucket);
    const failed = checkFailed(app);
    const held = checkHeld(app.name, scoopPath, globalScoopPath);
    const outdated = isOutdated(app.version, latestVersion);

    const info: string[] = [];
    if (failed) info.push("Install failed");
    if (held) info.push("Held package");
    if (deprecated) info.push("Deprecated");
    if (removed) info.push("Manifest removed");

    return {
        name: app.name,
        installedVersion: app.version,
        latestVersion,
        scope: app.scope,
        outdated,
        failed,
        deprecated,
        removed,
        held,
        missingDeps: [],
        info,
    };
}

// Worker message handler
self.onmessage = (event: MessageEvent<StatusWorkerMessage>) => {
    const { apps, buckets, scoopPath, globalScoopPath } = event.data;
    const startTime = performance.now();
    const results: AppStatusResult[] = [];

    try {
        for (let i = 0; i < apps.length; i++) {
            const app = apps[i];
            const status = checkAppStatus(app, buckets, scoopPath, globalScoopPath);
            if (status) {
                results.push(status);
            }

            // Report progress after each app
            const progressResponse: StatusWorkerResponse = {
                type: "progress",
                progress: i + 1,
            };
            self.postMessage(progressResponse);
        }

        const checkTime = Math.round(performance.now() - startTime);
        const response: StatusWorkerResponse = {
            type: "results",
            results,
            checkTime,
        };

        self.postMessage(response);
    } catch (err) {
        const response: StatusWorkerResponse = {
            type: "error",
            error: err instanceof Error ? err.message : String(err),
        };

        self.postMessage(response);
    }
};
