/**
 * Worker script for parallel bucket scanning.
 * Each worker scans one bucket directory for matching manifests.
 */

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

declare var self: Worker;

export interface WorkerSearchMessage {
    type: "search";
    bucketName: string;
    bucketDir: string;
    query: string;
    caseSensitive: boolean;
    installedApps?: string[];
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
 * Scan a bucket directory for matching manifests
 */
function scanBucket(
    bucketName: string,
    bucketDir: string,
    query: string,
    caseSensitive: boolean,
    installedApps?: string[]
): WorkerSearchResult[] {
    const results: WorkerSearchResult[] = [];

    try {
        const files = readdirSync(bucketDir, { withFileTypes: true });
        const q = caseSensitive ? query : query.toLowerCase();

        // Convert installedApps to Set for O(1) lookup if provided
        const installedSet = installedApps ? new Set(installedApps) : undefined;

        for (const file of files) {
            if (!file.isFile() || !file.name.endsWith(".json")) continue;

            const appName = file.name.slice(0, -5); // Remove .json
            const nameLower = caseSensitive ? appName : appName.toLowerCase();

            // Optimization: Check if name matches before reading file
            // This skips reading/parsing thousands of files that don't match
            if (!nameLower.includes(q)) continue;

            // Optimization: If installedApps filter is set and app is not installed, skip
            if (installedSet && !installedSet.has(nameLower)) continue;

            const filePath = join(bucketDir, file.name);

            try {
                const content = readFileSync(filePath, "utf8");
                const manifest = JSON.parse(content);

                results.push({
                    name: appName,
                    version: manifest.version || "",
                    description: manifest.description || "",
                    bucket: bucketName,
                    binaries: extractBinaries(manifest.bin),
                });
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
    const { bucketName, bucketDir, query, caseSensitive, installedApps } = event.data;
    const startTime = performance.now();

    try {
        const results = scanBucket(bucketName, bucketDir, query, caseSensitive, installedApps);
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
