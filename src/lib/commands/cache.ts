/**
 * High-performance search cache with persistent storage and precomputed indexes.
 * This solves the cold start problem by maintaining a persistent cache of searchable data.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { findAllBucketsInScope } from "src/lib/manifests.ts";
import { debug } from "src/utils/logger.ts";

/**
 * Get the SWB data directory from environment variable or default to ~/.swb
 */
function getSwbDataDir(): string {
    // SWB_HOME replaces the home directory (~), so the path becomes $SWB_HOME/.swb
    const customHome = process.env.SWB_HOME;
    if (customHome) {
        return path.join(customHome, ".swb");
    }

    // Default to ~/.swb
    const home = process.env.USERPROFILE || process.env.HOME;
    if (!home) {
        throw new Error("Could not determine home directory (USERPROFILE/HOME)");
    }

    return path.join(home, ".swb");
}

export interface PackageIndexEntry {
    name: string;
    version?: string;
    description?: string;
    bucket: string;
    scope: "user" | "global";
    binaries: string[]; // Extracted binary names for faster binary search
    manifestPath: string;
    lastModified: number; // For cache invalidation
}

export interface BucketCacheEntry {
    bucketName: string;
    scope: "user" | "global";
    bucketDir: string;
    lastScanned: number;
    lastModified: number; // Latest modification time among all manifests
    packages: PackageIndexEntry[];
}

export interface SearchCache {
    version: string;
    lastUpdated: number;
    buckets: Record<string, BucketCacheEntry>; // key: `${scope}:${bucketName}`
}

const CACHE_VERSION = "1.0.0";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_MANIFEST_SIZE = 100000; // Skip very large files

class SearchCacheManager {
    private cache: SearchCache | null = null;
    private cacheFile: string;
    private cacheDir: string;

    constructor() {
        // Store cache in ~/.swb/cache (configurable via SWB_HOME)
        const swbDataDir = getSwbDataDir();
        this.cacheDir = path.join(swbDataDir, "cache");
        this.cacheFile = path.join(this.cacheDir, "search-cache.json");
    }

    private ensureCacheDir(): void {
        if (!existsSync(this.cacheDir)) {
            mkdirSync(this.cacheDir, { recursive: true });
        }
    }

    private loadCache(): SearchCache {
        if (this.cache) return this.cache;

        try {
            if (existsSync(this.cacheFile)) {
                const content = readFileSync(this.cacheFile, "utf8");
                const cached = JSON.parse(content) as SearchCache;

                // Validate cache version
                if (cached.version === CACHE_VERSION) {
                    this.cache = cached;
                    debug(`Loaded search cache with ${Object.keys(cached.buckets).length} buckets`);
                    return cached;
                }
                debug(`Cache version mismatch: ${cached.version} !== ${CACHE_VERSION}`);
            }
        } catch (error) {
            debug(`Failed to load cache: ${error}`);
        }

        // Return empty cache
        this.cache = {
            version: CACHE_VERSION,
            lastUpdated: 0,
            buckets: {},
        };
        return this.cache;
    }

    private saveCache(): void {
        if (!this.cache) return;

        try {
            this.ensureCacheDir();
            this.cache.lastUpdated = Date.now();
            const content = JSON.stringify(this.cache, null, 2);
            writeFileSync(this.cacheFile, content, "utf8");
            debug(`Saved search cache with ${Object.keys(this.cache.buckets).length} buckets`);
        } catch (error) {
            debug(`Failed to save cache: ${error}`);
        }
    }

    private extractBinaries(manifestContent: string): string[] {
        try {
            const manifest = JSON.parse(manifestContent);
            if (!manifest.bin) return [];

            const bins = Array.isArray(manifest.bin) ? manifest.bin : [manifest.bin];
            const binaries: string[] = [];

            for (const bin of bins) {
                if (typeof bin === "string") {
                    const filename = bin.split(/[/\\]/).pop() || bin;
                    const nameWithoutExt = filename.replace(/\.[^.]+$/, "");
                    binaries.push(nameWithoutExt);
                } else if (Array.isArray(bin) && bin.length > 1) {
                    // Format: ["path/to/executable.exe", "alias"]
                    binaries.push(bin[1]);
                }
            }

            return binaries;
        } catch {
            return [];
        }
    }

    private async scanBucket(
        bucketInfo: { name: string; bucketDir: string },
        scope: "user" | "global",
        force = false
    ): Promise<BucketCacheEntry> {
        const bucketKey = `${scope}:${bucketInfo.name}`;
        const cache = this.loadCache();
        const now = Date.now();

        // Check if we have a valid cached entry
        const existing = cache.buckets[bucketKey];
        if (!force && existing && now - existing.lastScanned < CACHE_TTL_MS) {
            debug(`Using cached data for bucket ${bucketInfo.name} (${scope})`);
            return existing;
        }

        debug(`Scanning bucket ${bucketInfo.name} (${scope})`);
        const startTime = performance.now();

        if (!existsSync(bucketInfo.bucketDir)) {
            debug(`Bucket directory not found: ${bucketInfo.bucketDir}`);
            return {
                bucketName: bucketInfo.name,
                scope,
                bucketDir: bucketInfo.bucketDir,
                lastScanned: now,
                lastModified: 0,
                packages: [],
            };
        }

        try {
            // Get all JSON files
            const dirEntries = await readdir(bucketInfo.bucketDir, { withFileTypes: true });
            const jsonFiles = dirEntries
                .filter(f => f.isFile() && f.name.endsWith(".json"))
                .map(f => f.name.slice(0, -5)); // Remove .json extension

            const packages: PackageIndexEntry[] = [];
            let maxModified = 0;

            // Process files with better concurrency control
            const BATCH_SIZE = 10;
            for (let i = 0; i < jsonFiles.length; i += BATCH_SIZE) {
                const batch = jsonFiles.slice(i, i + BATCH_SIZE);

                const batchPromises = batch.map(async appName => {
                    try {
                        const manifestPath = path.join(bucketInfo.bucketDir, `${appName}.json`);
                        const stats = await stat(manifestPath);

                        // Skip very large files
                        if (stats.size > MAX_MANIFEST_SIZE) {
                            debug(`Skipping large manifest: ${manifestPath} (${stats.size} bytes)`);
                            return null;
                        }

                        maxModified = Math.max(maxModified, stats.mtimeMs);

                        // Check if we can reuse cached data for this specific package
                        const existingPkg = existing?.packages.find(p => p.name === appName);
                        if (existingPkg && existingPkg.lastModified >= stats.mtimeMs) {
                            return existingPkg;
                        }

                        const content = await readFile(manifestPath, "utf8");
                        const manifest = JSON.parse(content);

                        const entry: PackageIndexEntry = {
                            name: appName,
                            version: manifest.version,
                            description: manifest.description,
                            bucket: bucketInfo.name,
                            scope,
                            binaries: this.extractBinaries(content),
                            manifestPath,
                            lastModified: stats.mtimeMs,
                        };

                        return entry;
                    } catch (error) {
                        debug(`Failed to process ${appName}: ${error}`);
                        return null;
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                packages.push(
                    ...batchResults.filter((pkg): pkg is PackageIndexEntry => pkg !== null)
                );

                // Small yield between batches
                if (i + BATCH_SIZE < jsonFiles.length) {
                    await new Promise(resolve => setImmediate(resolve));
                }
            }

            const entry: BucketCacheEntry = {
                bucketName: bucketInfo.name,
                scope,
                bucketDir: bucketInfo.bucketDir,
                lastScanned: now,
                lastModified: maxModified,
                packages,
            };

            // Update cache
            cache.buckets[bucketKey] = entry;
            this.cache = cache;

            const elapsed = Math.round(performance.now() - startTime);
            debug(`Scanned bucket ${bucketInfo.name}: ${packages.length} packages in ${elapsed}ms`);

            return entry;
        } catch (error) {
            debug(`Error scanning bucket ${bucketInfo.name}: ${error}`);
            return {
                bucketName: bucketInfo.name,
                scope,
                bucketDir: bucketInfo.bucketDir,
                lastScanned: now,
                lastModified: 0,
                packages: [],
            };
        }
    }

    async updateCache(force = false): Promise<void> {
        const startTime = performance.now();
        debug("Updating search cache...");

        const scopes: ("user" | "global")[] = ["user", "global"];
        const updatePromises: Promise<void>[] = [];

        for (const scope of scopes) {
            const buckets = findAllBucketsInScope(scope);

            for (const bucketInfo of buckets) {
                updatePromises.push(this.scanBucket(bucketInfo, scope, force).then(() => {}));
            }
        }

        await Promise.all(updatePromises);
        this.saveCache();

        const elapsed = Math.round(performance.now() - startTime);
        debug(`Cache update completed in ${elapsed}ms`);
    }

    search(
        query: string,
        options: {
            caseSensitive?: boolean;
            bucket?: string;
            installedOnly?: boolean;
        } = {}
    ): PackageIndexEntry[] {
        const cache = this.loadCache();
        const flags = options.caseSensitive ? "" : "i";
        const pattern = new RegExp(query, flags);
        const results: PackageIndexEntry[] = [];
        const seenPackages = new Set<string>();

        for (const [bucketKey, bucketEntry] of Object.entries(cache.buckets)) {
            // Filter by specific bucket if requested
            if (options.bucket && bucketEntry.bucketName !== options.bucket) {
                continue;
            }

            for (const pkg of bucketEntry.packages) {
                const packageKey = `${pkg.bucket}:${pkg.name}`;
                if (seenPackages.has(packageKey)) continue;

                // Check name match
                if (pattern.test(pkg.name)) {
                    seenPackages.add(packageKey);
                    results.push(pkg);
                    continue;
                }

                // Check binary matches
                for (const binary of pkg.binaries) {
                    if (pattern.test(binary)) {
                        seenPackages.add(packageKey);
                        results.push(pkg);
                        break;
                    }
                }
            }
        }

        // Sort results: exact matches first, then alphabetical
        results.sort((a, b) => {
            const isSimpleQuery = query.length > 1 && !/[.*+?^${}()|[\]\\]/.test(query);
            if (isSimpleQuery) {
                const aExact = a.name.toLowerCase() === query.toLowerCase();
                const bExact = b.name.toLowerCase() === query.toLowerCase();
                if (aExact && !bExact) return -1;
                if (!aExact && bExact) return 1;
            }
            return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });

        return results;
    }

    async ensureFreshCache(): Promise<void> {
        const cache = this.loadCache();
        const now = Date.now();

        // If cache is completely empty or very old, force update
        if (Object.keys(cache.buckets).length === 0 || now - cache.lastUpdated > CACHE_TTL_MS) {
            await this.updateCache();
        }
    }

    clearCache(): void {
        this.cache = null;
        try {
            if (existsSync(this.cacheFile)) {
                // Instead of deleting, we'll overwrite with empty cache
                const emptyCache: SearchCache = {
                    version: CACHE_VERSION,
                    lastUpdated: 0,
                    buckets: {},
                };
                writeFileSync(this.cacheFile, JSON.stringify(emptyCache, null, 2), "utf8");
                debug("Search cache cleared");
            }
        } catch (error) {
            debug(`Failed to clear cache: ${error}`);
        }
    }
}

// Export singleton instance
export const searchCache = new SearchCacheManager();
