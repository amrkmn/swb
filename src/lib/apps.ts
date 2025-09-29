/**
 * Apps utilities: scan installed apps and resolve current version.
 * Conventions follow Scoop:
 * - <root>\apps\<name>\current is a junction/symlink to version folder (e.g., 2.44.0)
 */

import { existsSync, lstatSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { bothScopes, resolveScoopPaths, type InstallScope } from "src/lib/paths.ts";

export interface InstalledApp {
    name: string;
    scope: InstallScope; // "user" | "global"
    appDir: string; // <root>\apps\<name>
    currentPath: string | null; // resolved full path of "current" target, if any
    version: string | null; // basename of current target, if resolvable
}

export function readCurrentTarget(appDir: string): {
    target: string | null;
    version: string | null;
} {
    const cur = path.join(appDir, "current");
    if (!existsSync(cur)) return { target: null, version: null };
    try {
        // On Windows, current is a junction/symlink to the version dir.
        const resolved = realpathSync(cur);
        const version = path.basename(resolved);
        return { target: resolved, version };
    } catch {
        // Not a link or resolution failed
        return { target: null, version: null };
    }
}

// Cache for installed apps to avoid repeated filesystem operations
let installedAppsCache: { apps: InstalledApp[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 30000; // 30 seconds cache

function getCachedInstalledApps(): InstalledApp[] | null {
    if (!installedAppsCache) return null;

    const now = Date.now();
    if (now - installedAppsCache.timestamp > CACHE_TTL_MS) {
        installedAppsCache = null;
        return null;
    }

    return installedAppsCache.apps;
}

function setCachedInstalledApps(apps: InstalledApp[]): void {
    installedAppsCache = {
        apps: [...apps], // Create a copy to avoid mutations
        timestamp: Date.now(),
    };
}

export function listInstalledApps(filter?: string): InstalledApp[] {
    // Check cache first
    const cached = getCachedInstalledApps();
    if (cached) {
        // Apply filter if provided
        if (typeof filter === "string" && filter.trim() !== "") {
            const normFilter = filter.toLowerCase();
            return cached.filter(app => app.name.toLowerCase().includes(normFilter));
        }
        return cached;
    }

    const results: InstalledApp[] = [];
    const scopes = bothScopes();

    const normFilter =
        typeof filter === "string" && filter.trim() !== "" ? filter.toLowerCase() : null;

    for (const sp of scopes) {
        const appsDir = path.join(sp.root, "apps");
        if (!existsSync(appsDir)) continue;
        let names: string[] = [];
        try {
            names = readdirSync(appsDir, { withFileTypes: true })
                .filter(
                    (d: any) =>
                        d.isDirectory?.() || lstatSync(path.join(appsDir, d.name)).isDirectory()
                )
                .map((d: any) => d.name);
        } catch {
            continue;
        }

        for (const name of names) {
            if (normFilter && !name.toLowerCase().includes(normFilter)) continue;
            const appDir = path.join(appsDir, name);
            const { target, version } = readCurrentTarget(appDir);
            results.push({
                name,
                scope: sp.scope,
                appDir,
                currentPath: target,
                version,
            });
        }
    }

    // Sort by name ascending, then scope (user before global)
    results.sort((a, b) => {
        const n = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
        if (n !== 0) return n;
        if (a.scope === b.scope) return 0;
        return a.scope === "user" ? -1 : 1;
    });

    // Cache the full results (without filter applied)
    if (!filter) {
        setCachedInstalledApps(results);
    }

    return results;
}

/**
 * Resolve the install prefix for an app.
 * - If scope is provided, only check that scope.
 * - Otherwise, prefer user scope, then global.
 * @param appName - The name of the app
 * @param scope - Optional scope to limit search to
 * @param returnCurrentPath - If true, returns the 'current' symlink path; if false, returns the resolved versioned path
 */
export function resolveAppPrefix(
    appName: string,
    scope?: InstallScope,
    returnCurrentPath: boolean = false
): string | null {
    const scopes = scope ? [resolveScoopPaths(scope)] : bothScopes();
    for (const sp of scopes) {
        const appDir = path.join(sp.root, "apps", appName);
        const currentPath = path.join(appDir, "current");

        if (existsSync(currentPath)) {
            // Verify that current points to a valid target
            const { target } = readCurrentTarget(appDir);
            if (target && existsSync(target)) {
                return returnCurrentPath ? currentPath : target;
            }
        }
    }
    return null;
}

/**
 * @deprecated Use resolveAppPrefix with returnCurrentPath parameter instead
 * Resolve the app prefix path to the 'current' symlink (like Scoop's prefix command).
 * Returns the 'current' symlink path, not the resolved target.
 */
export function resolveAppCurrentPath(appName: string, scope?: InstallScope): string | null {
    return resolveAppPrefix(appName, scope, true);
}
