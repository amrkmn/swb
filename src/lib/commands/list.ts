import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { InstalledApp } from "src/lib/apps.ts";
import { bold, cyan, dim, green, magenta, yellow } from "src/utils/colors.ts";
import { formatLineColumns } from "src/utils/helpers.ts";
import { log, newline } from "src/utils/logger.ts";

export interface AppListInfo {
    name: string;
    version: string;
    bucket: string | null;
    updated: Date | null;
    held: boolean;
    scope: "user" | "global";
}

/**
 * Get install.json info for an app
 */
function getInstallInfo(
    appName: string,
    scope: "user" | "global"
): { bucket: string | null; held: boolean } {
    const scoopPath =
        scope === "global"
            ? process.env.SCOOP_GLOBAL || "C:\\ProgramData\\scoop"
            : process.env.SCOOP || join(process.env.USERPROFILE || "", "scoop");

    const installJsonPath = join(scoopPath, "apps", appName, "current", "install.json");

    if (existsSync(installJsonPath)) {
        try {
            const content = JSON.parse(readFileSync(installJsonPath, "utf-8"));
            return {
                bucket: content.bucket || null,
                held: content.hold === true,
            };
        } catch {
            // Ignore parse errors
        }
    }

    return { bucket: null, held: false };
}

/**
 * Get the last modified date of an app's current directory
 */
function getUpdateDate(app: InstalledApp): Date | null {
    if (!app.currentPath) return null;

    try {
        const stats = statSync(app.currentPath);
        return stats.mtime;
    } catch {
        return null;
    }
}

/**
 * Format a date as relative time or short date
 */
function formatDate(date: Date | null): string {
    if (!date) return "";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;

    // For older dates, show the actual date
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

/**
 * Get extended info for all apps
 */
export function getAppsListInfo(apps: InstalledApp[]): AppListInfo[] {
    return apps.map(app => {
        const { bucket, held } = getInstallInfo(app.name, app.scope);
        const updated = getUpdateDate(app);

        return {
            name: app.name,
            version: app.version || "unknown",
            bucket,
            updated,
            held,
            scope: app.scope,
        };
    });
}

/**
 * Display apps in table format
 */
export function displayAppsList(apps: AppListInfo[]): void {
    if (apps.length === 0) return;

    // Prepare table data with header
    const tableData: string[][] = [
        ["Name", "Version", "Source", "Updated", "Info"].map(h => bold(green(h))),
    ];

    for (const app of apps) {
        const name = cyan(app.name);
        const version = app.version;

        // Source: bucket name or scope
        const source = app.bucket || (app.scope === "global" ? "global" : "");

        // Updated date
        const updated = formatDate(app.updated);

        // Info flags with colors
        const infoFlags: string[] = [];
        if (app.held) infoFlags.push(yellow("Held"));
        if (app.scope === "global") infoFlags.push(magenta("Global"));
        const info = infoFlags.join(", ");

        tableData.push([name, version, source, updated, info]);
    }

    const formattedTable = formatLineColumns(tableData);
    log(formattedTable);
}

/**
 * Display apps in JSON format
 */
export function displayAppsListJson(apps: AppListInfo[]): void {
    const jsonOutput = apps.map(app => ({
        name: app.name,
        version: app.version,
        bucket: app.bucket,
        updated: app.updated?.toISOString() || null,
        held: app.held,
        scope: app.scope,
    }));

    log(JSON.stringify(jsonOutput, null, 2));
}

/**
 * Display summary line
 */
export function displayListSummary(total: number, query?: string): void {
    newline();
    if (query) {
        log(dim(`${total} app${total !== 1 ? "s" : ""} matching "${query}"`));
    } else {
        log(dim(`${total} app${total !== 1 ? "s" : ""} installed`));
    }
}

// Legacy format function for backwards compatibility
export function formatRow(name: string, version: string, flags: string[]): string {
    const flagStr = flags.length > 0 ? ` ${dim(`[${flags.join(", ")}]`)}` : "";
    return `${cyan(name)} ${green(version)}${flagStr}`;
}
