import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { Service } from "src/core/Context";
import { resolveScoopPaths, type InstallScope } from "src/utils/paths";

export interface FoundManifest {
    source: "installed" | "bucket";
    scope: InstallScope;
    bucket?: string | null;
    app: string;
    filePath: string;
    manifest: any;
}

export interface InfoFields {
    name: string;
    version: string;
    installedVersion?: string | null;
    latestVersion?: string | null;
    description: string;
    homepage: string;
    license: string | { identifier: string; url?: string };
    source?: string;
    deprecated?: boolean;
    updateAvailable?: boolean;
    installDate?: string | null;
}

export class ManifestService extends Service {
    /**
     * Find all manifests matching the input (app name or bucket/app)
     */
    findAllManifests(input: string): FoundManifest[] {
        const { bucket, app } = this.parseBucketAndApp(input);
        const results: FoundManifest[] = [];

        // 1. Check installed
        const installed = this.findInstalledManifest(app);
        if (installed) {
            results.push(installed);
        }

        // 2. Search buckets
        const scopes: InstallScope[] = ["user", "global"];

        if (bucket) {
            // Search specific bucket
            for (const scope of scopes) {
                const sp = resolveScoopPaths(scope);

                // Try bucket subdir
                const bucketSubDir = path.join(sp.buckets, bucket, "bucket", `${app}.json`);
                if (existsSync(bucketSubDir)) {
                    try {
                        const data = JSON.parse(readFileSync(bucketSubDir, "utf8"));
                        results.push({
                            source: "bucket",
                            scope,
                            bucket,
                            app,
                            filePath: bucketSubDir,
                            manifest: data,
                        });
                    } catch {}
                }

                // Try root dir
                const bucketRootDir = path.join(sp.buckets, bucket, `${app}.json`);
                if (existsSync(bucketRootDir)) {
                    try {
                        const data = JSON.parse(readFileSync(bucketRootDir, "utf8"));
                        results.push({
                            source: "bucket",
                            scope,
                            bucket,
                            app,
                            filePath: bucketRootDir,
                            manifest: data,
                        });
                    } catch {}
                }
            }
        } else {
            // Search all buckets
            for (const scope of scopes) {
                const buckets = this.findAllBucketsInScope(scope);
                for (const b of buckets) {
                    const file = path.join(b.bucketDir, `${app}.json`);
                    if (existsSync(file)) {
                        try {
                            const data = JSON.parse(readFileSync(file, "utf8"));
                            results.push({
                                source: "bucket",
                                scope,
                                bucket: b.name,
                                app,
                                filePath: file,
                                manifest: data,
                            });
                        } catch {}
                    }
                }
            }
        }

        return results;
    }

    findInstalledManifest(app: string): FoundManifest | null {
        const scopes: InstallScope[] = ["user", "global"];
        for (const scope of scopes) {
            const prefix = this.resolveAppPrefix(app, scope);
            if (!prefix) continue;

            const manifestPath = path.join(prefix, "manifest.json");
            if (existsSync(manifestPath)) {
                try {
                    const data = JSON.parse(readFileSync(manifestPath, "utf8"));

                    // Check install.json for bucket info
                    let bucketInfo: string | null = null;
                    const installJsonPath = path.join(prefix, "install.json");
                    if (existsSync(installJsonPath)) {
                        try {
                            const installData = JSON.parse(readFileSync(installJsonPath, "utf8"));
                            bucketInfo = installData.bucket || null;
                        } catch {}
                    }

                    return {
                        source: "installed",
                        scope,
                        bucket: bucketInfo,
                        app,
                        filePath: manifestPath,
                        manifest: data,
                    };
                } catch {}
            }
        }
        return null;
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

    private findAllBucketsInScope(scope: InstallScope): { name: string; bucketDir: string }[] {
        const sp = resolveScoopPaths(scope);
        const bucketsRoot = sp.buckets;
        if (!existsSync(bucketsRoot)) return [];

        try {
            const names = readdirSync(bucketsRoot, { withFileTypes: true })
                .filter((d: any) => d.isDirectory?.())
                .map((d: any) => d.name);

            return names.map(name => {
                const bucketRootDir = path.join(bucketsRoot, name);
                const bucketSubDir = path.join(bucketRootDir, "bucket");

                if (existsSync(bucketSubDir)) {
                    try {
                        const hasJson = readdirSync(bucketSubDir).some(f => f.endsWith(".json"));
                        if (hasJson) return { name, bucketDir: bucketSubDir };
                    } catch {}
                }
                return { name, bucketDir: bucketRootDir };
            });
        } catch {
            return [];
        }
    }

    private parseBucketAndApp(input: string): { bucket?: string; app: string } {
        const ix = input.indexOf("/");
        if (ix >= 0) {
            const bucket = input.slice(0, ix).trim();
            const app = input.slice(ix + 1).trim();
            if (bucket && app) return { bucket, app };
        }
        return { app: input.trim() };
    }

    // Helper to extract fields for view
    readManifestFields(app: string, fm: FoundManifest): InfoFields {
        const m = fm.manifest || {};
        const fields: InfoFields = {
            name: app,
            version: typeof m.version === "string" ? m.version : "unknown",
            description: typeof m.description === "string" ? m.description : "",
            homepage: typeof m.homepage === "string" ? m.homepage : "",
            license: "",
        };

        if (typeof m.license === "string") {
            fields.license = m.license;
        } else if (m.license && typeof m.license === "object" && m.license.identifier) {
            fields.license = m.license;
        }

        if (Boolean(m.deprecated) || Boolean(m.DELETED) || Boolean(m.deprecated_by)) {
            fields.deprecated = true;
        }

        if (fm.source === "bucket") {
            fields.source = fm.bucket || "bucket";
        } else {
            if (fm.bucket) fields.source = fm.bucket;
            else if (typeof m.bucket === "string") fields.source = m.bucket;
            else if (typeof m._source === "string") fields.source = m._source;
            else if (typeof m.scoop === "object" && typeof m.scoop.bucket === "string")
                fields.source = m.scoop.bucket;
            else fields.source = "installed";
        }

        return fields;
    }

    readManifestPair(
        app: string,
        installed: FoundManifest | null,
        bucket: FoundManifest | null
    ): InfoFields {
        const fields: InfoFields = {
            name: app,
            version: bucket?.manifest?.version || installed?.manifest?.version || "unknown",
            description: bucket?.manifest?.description || installed?.manifest?.description || "",
            homepage: bucket?.manifest?.homepage || installed?.manifest?.homepage || "",
            license: "",
        };

        if (bucket?.manifest?.license) {
            const m = bucket.manifest;
            if (typeof m.license === "string") {
                fields.license = m.license;
            } else if (typeof m.license === "object" && m.license.identifier) {
                fields.license = m.license;
            }
        }

        fields.installedVersion = installed?.manifest?.version || null;
        fields.latestVersion = bucket?.manifest?.version || null;

        if (
            fields.installedVersion &&
            fields.latestVersion &&
            fields.installedVersion !== fields.latestVersion
        ) {
            fields.updateAvailable = true;
        }

        fields.deprecated = Boolean(
            bucket?.manifest?.deprecated ||
            bucket?.manifest?.DELETED ||
            bucket?.manifest?.deprecated_by
        );

        const primarySource = bucket || installed;
        if (primarySource) {
            if (primarySource.source === "bucket") {
                fields.source = primarySource.bucket || "bucket";
            } else {
                if (primarySource.bucket) fields.source = primarySource.bucket;
                else if (typeof primarySource.manifest?.bucket === "string")
                    fields.source = primarySource.manifest.bucket;
                else if (typeof primarySource.manifest?._source === "string")
                    fields.source = primarySource.manifest._source;
                else if (
                    typeof primarySource.manifest?.scoop === "object" &&
                    typeof primarySource.manifest.scoop.bucket === "string"
                )
                    fields.source = primarySource.manifest.scoop.bucket;
                else fields.source = "installed";
            }
        }

        return fields;
    }

    findManifestPair(input: string): {
        installed: FoundManifest | null;
        bucket: FoundManifest | null;
    } {
        const results = this.findAllManifests(input);
        return {
            installed: results.find(r => r.source === "installed") || null,
            bucket: results.find(r => r.source === "bucket") || null,
        };
    }
}
