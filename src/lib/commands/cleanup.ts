import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { readCurrentTarget } from "src/lib/apps.ts";
import type { InstallScope } from "src/lib/paths.ts";
import { resolveScoopPaths } from "src/lib/paths.ts";
import { dim, green } from "src/utils/colors.ts";
import { info, log, success, verbose as verboseLog, warn } from "src/utils/logger.ts";

export interface CleanupOptions {
    cache: boolean;
    global: boolean;
    verbose: boolean;
    suppressWarnings?: boolean;
}

export interface CleanupResult {
    app: string;
    scope: InstallScope;
    oldVersions: Array<{ version: string; size: number }>;
    failedVersions: Array<{ version: string; error: string }>;
    cacheFiles: Array<{ name: string; size: number }>;
}

/**
 * Get all versions of an app (excluding 'current')
 */
function getAppVersions(appDir: string): string[] {
    if (!existsSync(appDir)) return [];

    try {
        const entries = readdirSync(appDir, { withFileTypes: true });
        return entries
            .filter(entry => entry.isDirectory() && entry.name !== "current")
            .map(entry => entry.name);
    } catch {
        return [];
    }
}

/**
 * Get size of a directory recursively
 */
function getDirectorySize(dirPath: string): number {
    let size = 0;

    try {
        const entries = readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            try {
                if (entry.isDirectory()) {
                    size += getDirectorySize(fullPath);
                } else {
                    const stats = statSync(fullPath);
                    size += stats.size;
                }
            } catch {}
        }
    } catch {}

    return size;
}

/**
 * Format bytes to human-readable size
 */
function formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Clean up old versions of a single app
 */
export function cleanupApp(
    appName: string,
    scope: InstallScope,
    options: CleanupOptions
): CleanupResult {
    const paths = resolveScoopPaths(scope);
    const appDir = path.join(paths.apps, appName);
    const result: CleanupResult = {
        app: appName,
        scope,
        oldVersions: [],
        failedVersions: [],
        cacheFiles: [],
    };

    const { version: currentVersion } = readCurrentTarget(appDir);
    if (!currentVersion) {
        if (options.verbose) {
            verboseLog(`${appName}: No current version found, skipping`);
        }
        return result;
    }

    const allVersions = getAppVersions(appDir);
    const oldVersions = allVersions.filter(v => v !== currentVersion);

    if (oldVersions.length === 0) {
        if (options.verbose) {
            verboseLog(`${appName}: No old versions to clean up`);
        }
    } else {
        for (const version of oldVersions) {
            const versionDir = path.join(appDir, version);
            try {
                const size = getDirectorySize(versionDir);
                rmSync(versionDir, { recursive: true, force: true });
                result.oldVersions.push({ version, size });
                if (options.verbose) {
                    verboseLog(`${appName}: Removed version ${version} (${formatSize(size)})`);
                }
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                result.failedVersions.push({ version, error: errorMsg });

                if (!options.suppressWarnings) {
                    if (errorMsg.includes("EBUSY") || errorMsg.includes("resource busy")) {
                        warn(
                            `Cannot remove ${appName} ${version}: app may be running. Close it and try again.`
                        );
                    } else if (
                        errorMsg.includes("EPERM") ||
                        errorMsg.includes("permission denied")
                    ) {
                        warn(
                            `Cannot remove ${appName} ${version}: permission denied. Try running as administrator.`
                        );
                    } else {
                        warn(`Failed to remove ${appName} ${version}: ${errorMsg}`);
                    }
                }
            }
        }
    }

    if (options.cache) {
        const cacheDir = paths.cache;
        if (existsSync(cacheDir)) {
            try {
                const cacheEntries = readdirSync(cacheDir);
                for (const entry of cacheEntries) {
                    // Cache file format: appname#version#url.ext or appname#version.ext
                    if (entry.startsWith(`${appName}#`)) {
                        if (
                            !entry.includes(`#${currentVersion}#`) &&
                            !entry.startsWith(`${appName}#${currentVersion}.`)
                        ) {
                            const cachePath = path.join(cacheDir, entry);
                            try {
                                const stats = statSync(cachePath);
                                const size = stats.size;
                                rmSync(cachePath, { force: true });
                                result.cacheFiles.push({ name: entry, size });
                                if (options.verbose) {
                                    verboseLog(
                                        `${appName}: Removed cache file ${entry} (${formatSize(size)})`
                                    );
                                }
                            } catch {}
                        }
                    }
                }
            } catch {}
        }
    }

    return result;
}

/**
 * Display cleanup results for a single app (called during cleanup)
 */
export function displayAppCleanupResult(result: CleanupResult, maxWidth = 0): void {
    const scopeStr = result.scope === "global" ? " (global)" : "";

    if (
        result.oldVersions.length === 0 &&
        result.cacheFiles.length === 0 &&
        result.failedVersions.length === 0
    ) {
        return;
    }

    // Build version string (join with comma)
    const versions = result.oldVersions.map(v => v.version).join(", ");

    // Calculate total space freed
    const versionsSpace = result.oldVersions.reduce((sum, v) => sum + v.size, 0);
    const cacheSpace = result.cacheFiles.reduce((sum, c) => sum + c.size, 0);
    const totalSpace = versionsSpace + cacheSpace;

    const freedStr = totalSpace > 0 ? ` [${green(formatSize(totalSpace))}]` : "";

    // Pad app name to align columns
    let paddedName = result.app;
    if (maxWidth > 0) {
        const currentWidth = Bun.stringWidth(result.app);
        const spacesToAdd = maxWidth - currentWidth;
        if (spacesToAdd > 0) {
            paddedName = result.app + " ".repeat(spacesToAdd);
        }
    }

    log(`${paddedName}: ${versions}${freedStr}${scopeStr}`);
}
/**
 * Display cleanup summary
 */
export function displayCleanupSummary(results: CleanupResult[]): void {
    let totalVersionsRemoved = 0;
    let totalVersionsFailed = 0;
    let totalCacheFilesRemoved = 0;
    let totalVersionsSpace = 0;
    let totalCacheSpace = 0;

    for (const result of results) {
        totalVersionsRemoved += result.oldVersions.length;
        totalVersionsFailed += result.failedVersions.length;
        totalCacheFilesRemoved += result.cacheFiles.length;
        totalVersionsSpace += result.oldVersions.reduce((sum, v) => sum + v.size, 0);
        totalCacheSpace += result.cacheFiles.reduce((sum, c) => sum + c.size, 0);
    }

    // Summary
    const hasActivity =
        totalVersionsRemoved > 0 || totalCacheFilesRemoved > 0 || totalVersionsFailed > 0;

    if (!hasActivity) {
        log("");
        info("Nothing to clean up.");
        return;
    }

    log("");
    if (totalVersionsRemoved > 0 || totalCacheFilesRemoved > 0) {
        success("Cleanup complete");
        if (totalVersionsRemoved > 0) {
            log(
                `  ${dim("Old versions removed:")} ${totalVersionsRemoved} (${green(formatSize(totalVersionsSpace))})`
            );
        }
        if (totalCacheFilesRemoved > 0) {
            log(
                `  ${dim("Cache files removed:")} ${totalCacheFilesRemoved} (${green(formatSize(totalCacheSpace))})`
            );
        }
        log(
            `  ${dim("Total space freed:")} ${green(formatSize(totalVersionsSpace + totalCacheSpace))}`
        );
    }

    if (totalVersionsFailed > 0) {
        log("");
        warn(`${totalVersionsFailed} version(s) could not be removed (likely in use or locked)`);
        info("Tip: Close running apps and try again, or run as administrator if needed.");
    }
}
