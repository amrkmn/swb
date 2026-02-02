import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { Service } from "src/core/Context";
import { bothScopes, resolveScoopPaths, type InstallScope } from "src/utils/paths";

export interface InstalledApp {
    name: string;
    scope: InstallScope;
    appDir: string;
    currentPath: string | null;
    version: string | null;
    bucket?: string | null;
    updated: Date | null;
    held: boolean;
}

export class AppsService extends Service {
    private installedAppsCache: { apps: InstalledApp[]; timestamp: number } | null = null;
    private readonly CACHE_TTL_MS = 30000;

    /**
     * Resolve the installation prefix (path) of an app
     */
    getAppPrefix(appName: string, scope: InstallScope): string | null {
        return this.resolveAppPrefix(appName, scope);
    }

    /**
     * List all installed apps
     */
    listInstalled(filter?: string): InstalledApp[] {
        // Check cache first
        const cached = this.getCachedInstalledApps();
        if (cached) {
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
                const info = this.readAppInfo(appDir);

                results.push({
                    name,
                    scope: sp.scope,
                    appDir,
                    currentPath: info.target,
                    version: info.version,
                    bucket: info.bucket,
                    updated: info.updated,
                    held: info.held,
                });
            }
        }

        results.sort((a, b) => {
            const n = a.name.localeCompare(b.name, "en", { sensitivity: "base" });
            if (n !== 0) return n;
            if (a.scope === b.scope) return 0;
            return a.scope === "user" ? -1 : 1;
        });

        if (!filter) {
            this.setCachedInstalledApps(results);
        }

        return results;
    }

    private resolveAppPrefix(appName: string, scope: InstallScope): string | null {
        const sp = resolveScoopPaths(scope);
        const appDir = path.join(sp.root, "apps", appName);
        const currentPath = path.join(appDir, "current");

        if (existsSync(currentPath)) {
            try {
                const resolved = realpathSync(currentPath);
                if (existsSync(resolved)) return resolved;
            } catch {}
        }
        return null;
    }

    private readAppInfo(appDir: string): {
        target: string | null;
        version: string | null;
        bucket: string | null;
        updated: Date | null;
        held: boolean;
    } {
        const cur = path.join(appDir, "current");
        if (!existsSync(cur))
            return { target: null, version: null, bucket: null, updated: null, held: false };
        try {
            const resolved = realpathSync(cur);
            const version = path.basename(resolved);
            let bucket: string | null = null;
            let held = false;
            let updated: Date | null = null;

            const installJson = path.join(resolved, "install.json");
            if (existsSync(installJson)) {
                try {
                    const content = JSON.parse(readFileSync(installJson, "utf8"));
                    bucket = content.bucket || null;
                    held = content.hold === true;
                } catch {}
            }

            try {
                updated = statSync(resolved).mtime;
            } catch {}

            return { target: resolved, version, bucket, updated, held };
        } catch {
            return { target: null, version: null, bucket: null, updated: null, held: false };
        }
    }

    private getCachedInstalledApps(): InstalledApp[] | null {
        if (!this.installedAppsCache) return null;
        const now = Date.now();
        if (now - this.installedAppsCache.timestamp > this.CACHE_TTL_MS) {
            this.installedAppsCache = null;
            return null;
        }
        return this.installedAppsCache.apps;
    }

    private setCachedInstalledApps(apps: InstalledApp[]): void {
        this.installedAppsCache = { apps: [...apps], timestamp: Date.now() };
    }
}
