import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { Service } from "src/core/Context";
import { resolveScoopPaths, type InstallScope } from "src/utils/paths";

export interface CleanupOptions {
    cache: boolean;
    global: boolean;
    verbose: boolean;
    dryRun: boolean;
    suppressWarnings?: boolean;
}

export interface CleanupResult {
    app: string;
    scope: InstallScope;
    oldVersions: Array<{ version: string; size: number }>;
    failedVersions: Array<{ version: string; error: string }>;
    cacheFiles: Array<{ name: string; size: number }>;
}

export class CleanupService extends Service {
    /**
     * Clean up old versions of a single app
     */
    cleanupApp(appName: string, scope: InstallScope, options: CleanupOptions): CleanupResult {
        const paths = resolveScoopPaths(scope);
        const appDir = path.join(paths.apps, appName);
        const result: CleanupResult = {
            app: appName,
            scope,
            oldVersions: [],
            failedVersions: [],
            cacheFiles: [],
        };

        const currentVersion = this.getCurrentVersion(appDir);
        if (!currentVersion) {
            return result;
        }

        const allVersions = this.getAppVersions(appDir);
        const oldVersions = allVersions.filter(v => v !== currentVersion);

        if (oldVersions.length > 0) {
            for (const version of oldVersions) {
                const versionDir = path.join(appDir, version);
                try {
                    const size = this.getDirectorySize(versionDir);
                    if (!options.dryRun) {
                        rmSync(versionDir, { recursive: true, force: true });
                    }
                    result.oldVersions.push({ version, size });
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : String(err);
                    result.failedVersions.push({ version, error: errorMsg });
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
                                    if (!options.dryRun) {
                                        rmSync(cachePath, { force: true });
                                    }
                                    result.cacheFiles.push({ name: entry, size });
                                } catch {}
                            }
                        }
                    }
                } catch {}
            }
        }

        return result;
    }

    private getCurrentVersion(appDir: string): string | null {
        // We could use AppsService logic here, but let's keep it self-contained or import helper
        // Since AppsService has readAppInfo which is private/public, we can replicate logic for robustness
        const cur = path.join(appDir, "current");
        if (!existsSync(cur)) return null;
        try {
            // resolve symlink
            const fs = require("fs");
            const resolved = fs.realpathSync(cur);
            return path.basename(resolved);
        } catch {
            return null;
        }
    }

    private getAppVersions(appDir: string): string[] {
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

    private getDirectorySize(dirPath: string): number {
        let size = 0;
        try {
            const entries = readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                try {
                    if (entry.isDirectory()) {
                        size += this.getDirectorySize(fullPath);
                    } else {
                        const stats = statSync(fullPath);
                        size += stats.size;
                    }
                } catch {}
            }
        } catch {}
        return size;
    }
}
