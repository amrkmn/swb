/**
 * Manifest discovery and reading helpers (Scoop-compatible).
 *
 * Resolution order for info:
 * 1) If app is installed: <root>\apps\<app>\current\manifest.json
 * 2) Else search local buckets: <root>\buckets\<bucket>\bucket\<app>.json
 *
 * Buckets may exist in user and global scopes; we search both.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { resolveAppPrefix } from "./apps.ts";
import { resolveScoopPaths } from "./paths.ts";

export interface FoundManifest {
    source: "installed" | "bucket";
    scope: "user" | "global";
    bucket?: string;
    app: string;
    filePath: string;
    manifest: any;
}

export interface InfoFields {
    name: string;
    // Required properties
    version: string;
    description: string;
    homepage: string;
    license: string | { identifier: string; url?: string };
    // Optional metadata
    source?: string; // bucket name or URL
    deprecated?: boolean;
}

export function parseBucketAndApp(input: string): { bucket?: string; app: string } {
    const ix = input.indexOf("/");
    if (ix >= 0) {
        const bucket = input.slice(0, ix).trim();
        const app = input.slice(ix + 1).trim();
        if (bucket && app) return { bucket, app };
    }
    return { app: input.trim() };
}

export function findInstalledManifest(app: string): FoundManifest | null {
    // Prefer installed manifest from user then global (by bothScopes sorting in apps.ts list function)
    // Here, explicitly check user then global for determinism.
    const scopes = [resolveScoopPaths("user"), resolveScoopPaths("global")];
    for (const sp of scopes) {
        const prefix = resolveAppPrefix(app, sp.scope);
        if (!prefix) continue;
        const manifestPath = path.join(prefix, "manifest.json");
        if (existsSync(manifestPath)) {
            try {
                const raw = readFileSync(manifestPath, "utf8");
                const data = JSON.parse(raw);

                // Also check install.json for bucket info
                const installJsonPath = path.join(prefix, "install.json");
                let bucketInfo = null;
                if (existsSync(installJsonPath)) {
                    try {
                        const installRaw = readFileSync(installJsonPath, "utf8");
                        const installData = JSON.parse(installRaw);
                        if (installData.bucket) {
                            bucketInfo = installData.bucket;
                        }
                    } catch {
                        // ignore install.json parse errors
                    }
                }

                return {
                    source: "installed",
                    scope: sp.scope,
                    bucket: bucketInfo, // Add bucket info from install.json
                    app,
                    filePath: manifestPath,
                    manifest: data,
                };
            } catch {
                // ignore parse errors here; let caller handle via bucket lookup fallback
            }
        }
    }
    return null;
}

export function findAllBucketsInScope(
    scope: "user" | "global"
): { name: string; bucketDir: string }[] {
    const sp = resolveScoopPaths(scope);
    const bucketsRoot = sp.buckets; // <root>\buckets
    if (!existsSync(bucketsRoot)) return [];
    let names: string[] = [];
    try {
        names = readdirSync(bucketsRoot, { withFileTypes: true })
            .filter((d: any) => d.isDirectory?.())
            .map((d: any) => d.name);
    } catch {
        return [];
    }
    return names.map(name => ({
        name,
        bucketDir: path.join(bucketsRoot, name, "bucket"),
    }));
}

export function findBucketManifest(input: string): FoundManifest | null {
    const { bucket, app } = parseBucketAndApp(input);

    const scopes: ("user" | "global")[] = ["user", "global"];

    // If bucket explicitly provided, search only that bucket name across scopes
    if (bucket) {
        for (const scope of scopes) {
            const sp = resolveScoopPaths(scope);
            const file = path.join(sp.buckets, bucket, "bucket", `${app}.json`);
            if (existsSync(file)) {
                try {
                    const raw = readFileSync(file, "utf8");
                    const data = JSON.parse(raw);
                    return {
                        source: "bucket",
                        scope,
                        bucket,
                        app,
                        filePath: file,
                        manifest: data,
                    };
                } catch {
                    // try next scope/bucket
                }
            }
        }
        return null;
    }

    // No explicit bucket: search all buckets in both scopes
    for (const scope of scopes) {
        const buckets = findAllBucketsInScope(scope);
        for (const b of buckets) {
            const file = path.join(b.bucketDir, `${app}.json`);
            if (existsSync(file)) {
                try {
                    const raw = readFileSync(file, "utf8");
                    const data = JSON.parse(raw);
                    return {
                        source: "bucket",
                        scope,
                        bucket: b.name,
                        app,
                        filePath: file,
                        manifest: data,
                    };
                } catch {
                    // keep searching
                }
            }
        }
    }

    return null;
}

// Find all instances of an app across all buckets and scopes
export function findAllManifests(input: string): FoundManifest[] {
    const { bucket, app } = parseBucketAndApp(input);
    const results: FoundManifest[] = [];

    // First, check if it's installed
    const installed = findInstalledManifest(app);
    if (installed) {
        results.push(installed);
    }

    // Then search buckets
    const scopes: ("user" | "global")[] = ["user", "global"];

    if (bucket) {
        // Search specific bucket only
        for (const scope of scopes) {
            const sp = resolveScoopPaths(scope);
            const file = path.join(sp.buckets, bucket, "bucket", `${app}.json`);
            if (existsSync(file)) {
                try {
                    const raw = readFileSync(file, "utf8");
                    const data = JSON.parse(raw);
                    results.push({
                        source: "bucket",
                        scope,
                        bucket,
                        app,
                        filePath: file,
                        manifest: data,
                    });
                } catch {
                    // continue searching
                }
            }
        }
    } else {
        // Search all buckets
        for (const scope of scopes) {
            const buckets = findAllBucketsInScope(scope);
            for (const b of buckets) {
                const file = path.join(b.bucketDir, `${app}.json`);
                if (existsSync(file)) {
                    try {
                        const raw = readFileSync(file, "utf8");
                        const data = JSON.parse(raw);
                        results.push({
                            source: "bucket",
                            scope,
                            bucket: b.name,
                            app,
                            filePath: file,
                            manifest: data,
                        });
                    } catch {
                        // continue searching
                    }
                }
            }
        }
    }

    return results;
}

export function readManifestFields(app: string, fm: FoundManifest): InfoFields {
    const m = fm.manifest || {};
    const fields: InfoFields = {
        name: app,
        version: m.version,
        description: m.description,
        homepage: m.homepage,
        license: m.license,
    };

    // Required properties according to Scoop manifest schema
    if (typeof m.version === "string") fields.version = m.version;
    if (typeof m.description === "string") fields.description = m.description;
    if (typeof m.homepage === "string") fields.homepage = m.homepage;

    // License can be string or object with identifier/url
    if (typeof m.license === "string") {
        fields.license = m.license;
    } else if (m.license && typeof m.license === "object") {
        if (m.license.identifier) {
            fields.license = m.license;
        }
    }

    // Deprecated markers vary across manifests; we check common keys
    const deprecated = Boolean(m.deprecated) || Boolean(m.DELETED) || Boolean(m.deprecated_by);
    if (deprecated) fields.deprecated = true;

    if (fm.source === "bucket") {
        fields.source = fm.bucket || "bucket";
    } else {
        // For installed apps, use bucket info from install.json if available
        if (fm.bucket) {
            fields.source = fm.bucket;
        } else if (typeof m.bucket === "string") {
            fields.source = m.bucket;
        } else if (typeof m._source === "string") {
            fields.source = m._source;
        } else if (typeof m.scoop === "object" && typeof m.scoop.bucket === "string") {
            fields.source = m.scoop.bucket;
        } else {
            fields.source = "installed";
        }
    }

    return fields;
}
