/**
 * Worker script for parallel bucket scanning.
 * Each worker scans one bucket directory for matching manifests.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";

declare var self: Worker;

export interface WorkerSearchMessage {
    type: "search";
    bucketName: string;
    bucketDir: string;
    query: string;
    caseSensitive: boolean;
}

export interface WorkerSearchResult {
    name: string;
    version: string;
    description: string;
    bucket: string;
    binaries: string[];
}

export interface WorkerResponse {
    type: "results" | "error";
    bucket: string;
    results?: WorkerSearchResult[];
    error?: string;
    searchTime?: number;
}

/**
 * Extract binary names from manifest bin field
 */
function extractBinaries(bin: any): string[] {
    if (!bin) return [];

    const binaries: string[] = [];

    if (typeof bin === "string") {
        binaries.push(basename(bin, ".exe"));
    } else if (Array.isArray(bin)) {
        for (const item of bin) {
            if (typeof item === "string") {
                binaries.push(basename(item, ".exe"));
            } else if (Array.isArray(item) && item.length >= 2) {
                // [target, alias] format
                binaries.push(String(item[1]));
            }
        }
    } else if (typeof bin === "object") {
        // Object format: { alias: path }
        for (const alias of Object.keys(bin)) {
            binaries.push(alias);
        }
    }

    return binaries;
}

/**
 * Check if a manifest matches the search query
 */
function matchesQuery(name: string, manifest: any, query: string, caseSensitive: boolean): boolean {
    const q = caseSensitive ? query : query.toLowerCase();
    const nameLower = caseSensitive ? name : name.toLowerCase();

    // Match against name
    if (nameLower.includes(q)) return true;

    // Match against binaries
    const binaries = extractBinaries(manifest.bin);
    for (const bin of binaries) {
        const binLower = caseSensitive ? bin : bin.toLowerCase();
        if (binLower.includes(q)) return true;
    }

    return false;
}

/**
 * Scan a bucket directory for matching manifests
 */
function scanBucket(
    bucketName: string,
    bucketDir: string,
    query: string,
    caseSensitive: boolean
): WorkerSearchResult[] {
    const results: WorkerSearchResult[] = [];

    try {
        const files = readdirSync(bucketDir, { withFileTypes: true });

        for (const file of files) {
            if (!file.isFile() || !file.name.endsWith(".json")) continue;

            const appName = file.name.slice(0, -5); // Remove .json
            const filePath = join(bucketDir, file.name);

            try {
                const content = readFileSync(filePath, "utf8");
                const manifest = JSON.parse(content);

                if (matchesQuery(appName, manifest, query, caseSensitive)) {
                    results.push({
                        name: appName,
                        version: manifest.version || "",
                        description: manifest.description || "",
                        bucket: bucketName,
                        binaries: extractBinaries(manifest.bin),
                    });
                }
            } catch {
                // Skip invalid manifests
            }
        }
    } catch {
        // Skip inaccessible directories
    }

    return results;
}

// Worker message handler
self.onmessage = (event: MessageEvent<WorkerSearchMessage>) => {
    const { bucketName, bucketDir, query, caseSensitive } = event.data;
    const startTime = performance.now();

    try {
        const results = scanBucket(bucketName, bucketDir, query, caseSensitive);
        const searchTime = Math.round(performance.now() - startTime);

        const response: WorkerResponse = {
            type: "results",
            bucket: bucketName,
            results,
            searchTime,
        };

        self.postMessage(response);
    } catch (err) {
        const response: WorkerResponse = {
            type: "error",
            bucket: bucketName,
            error: err instanceof Error ? err.message : String(err),
        };

        self.postMessage(response);
    }
};
