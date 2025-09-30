import { $ } from "bun";
import { existsSync, statSync } from "fs";
import { basename, join } from "path";
import { type InstalledApp } from "src/lib/apps.ts";
import { findAllBucketsInScope, findAllManifests, readManifestFields } from "src/lib/manifests.ts";
import { error, log, newline, success, warn } from "src/utils/logger.ts";

// Status information for an installed app
export interface AppStatus {
    name: string;
    installedVersion: string | null;
    latestVersion: string | null;
    scope: "user" | "global";
    outdated: boolean;
    failed: boolean;
    deprecated: boolean;
    removed: boolean;
    held: boolean;
    missingDeps: string[];
    info: string[];
}

// Check if a git repository has updates
export async function checkGitRepoStatus(repoPath: string): Promise<boolean> {
    try {
        const gitPath = join(repoPath, ".git");

        if (!existsSync(gitPath)) {
            const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
            const { mtimeMs } = statSync(repoPath);
            return mtimeMs < thirtyDaysAgo;
        }

        await $`git -C ${repoPath} fetch -q origin`;
        const branch = (await $`git -C ${repoPath} branch --show-current`.text()).trim();
        const count = Number(
            (await $`git -C ${repoPath} rev-list --count HEAD..origin/${branch}`.text()).trim()
        );

        if (count > 0) {
            return true;
        }

        return false;
    } catch (e) {
        warn(`Could not check for updates in repository: ${repoPath}`);
        // Log the error for debugging purposes
        if (e instanceof Error) {
            warn(e.message);
        }
        return false;
    }
}

// Get the latest version of an app from its manifest, checking all buckets
export function getLatestVersion(appName: string): string | null {
    try {
        const manifests = findAllManifests(appName);
        if (manifests.length === 0) return null;

        let latestVersion: string | null = null;
        let highestVersionNumber = [0, 0, 0, 0]; // Support up to 4 version parts

        // Check all manifests to find the highest version
        for (const manifest of manifests) {
            try {
                const fields = readManifestFields(appName, manifest);
                if (fields.version) {
                    const versionParts = parseVersionString(fields.version);
                    if (compareVersionArrays(versionParts, highestVersionNumber) > 0) {
                        highestVersionNumber = versionParts;
                        latestVersion = fields.version;
                    }
                }
            } catch {
                // Skip invalid manifests
                continue;
            }
        }

        return latestVersion;
    } catch {
        return null;
    }
}

// Parse version string into numeric array for comparison
export function parseVersionString(version: string): number[] {
    const cleaned = version.replace(/^v/, "").toLowerCase().trim();
    const parts = cleaned.split(/[.-]/).map(part => {
        const num = parseInt(part.replace(/[^\d]/g, ""));
        return isNaN(num) ? 0 : num;
    });

    // Pad to 4 parts for consistent comparison
    while (parts.length < 4) parts.push(0);
    return parts.slice(0, 4);
}

// Compare two version arrays, returns: 1 if a > b, -1 if a < b, 0 if equal
export function compareVersionArrays(a: number[], b: number[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const aVal = a[i] || 0;
        const bVal = b[i] || 0;
        if (aVal > bVal) return 1;
        if (aVal < bVal) return -1;
    }
    return 0;
}

// Check if an app installation failed (simplified check)
export function isInstallationFailed(app: InstalledApp): boolean {
    // Check if current path exists and is valid
    if (!app.currentPath || !existsSync(app.currentPath)) {
        return true;
    }

    // Check if version directory exists
    if (!app.version) {
        return true;
    }

    return false;
}

// Check if an app is deprecated (manifest is in deprecated bucket/location)
export function isAppDeprecated(appName: string): boolean {
    try {
        const manifests = findAllManifests(appName);
        for (const manifest of manifests) {
            if (manifest.filePath.includes("deprecated")) {
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
}

// Check if an app's manifest has been removed
export function isManifestRemoved(appName: string): boolean {
    const manifests = findAllManifests(appName);
    return manifests.length === 0;
}

// Compare installed and latest versions to determine if app is outdated
export function compareVersions(installed: string | null, latest: string | null): boolean {
    if (!installed || !latest) return false;
    if (installed === latest) return false;

    const installedParts = parseVersionString(installed);
    const latestParts = parseVersionString(latest);

    return compareVersionArrays(latestParts, installedParts) > 0;
}

export function raceForTrue(promises: Promise<boolean>[]): Promise<boolean> {
    return new Promise(resolve => {
        let count = 0;
        promises.forEach(p =>
            p
                .then(result => {
                    if (result === true) resolve(true);
                    else if (++count === promises.length) resolve(false);
                })
                .catch(() => ++count === promises.length && resolve(false))
        );
    });
}

// Check status internally without external dependencies, running checks in parallel
export async function checkInternalStatus(local: boolean): Promise<{
    scoopOutdated: boolean;
    bucketsOutdated: boolean;
}> {
    if (local) {
        return { scoopOutdated: false, bucketsOutdated: false };
    }

    let scoopOutdated = false;
    let bucketsOutdated = false;

    try {
        const scoopRepoPath = getScoopAppPath("scoop", "user");

        // Check scoop status
        scoopOutdated = await checkGitRepoStatus(scoopRepoPath);

        // Check buckets status
        const scopes: ("user" | "global")[] = ["user", "global"];
        const buckets = scopes.flatMap(scope => findAllBucketsInScope(scope));

        bucketsOutdated = await raceForTrue(
            buckets.map(async ({ bucketDir }) => {
                if (basename(bucketDir) !== "bucket") {
                    return await checkGitRepoStatus(bucketDir);
                }
                return await checkGitRepoStatus(join(bucketDir, ".."));
            })
        );
    } catch (e) {
        error("Could not check status:", e);
    }

    return { scoopOutdated, bucketsOutdated };
}

// Get the path to a Scoop app's current installation directory
export function getScoopAppPath(appName: string, scope: "user" | "global"): string {
    const scoopPath =
        scope === "global"
            ? process.env.SCOOP_GLOBAL || "C:\\ProgramData\\scoop"
            : process.env.SCOOP || join(process.env.USERPROFILE || "", "scoop");
    return join(scoopPath, "apps", appName, "current");
}

export function isAppHeld(appName: string): boolean {
    // Check if app is held in user scope
    const userHoldFile = join(getScoopAppPath(appName, "user"), "scoop-hold.txt");
    if (existsSync(userHoldFile)) {
        return true;
    }

    // Check if app is held in global scope
    const globalHoldFile = join(getScoopAppPath(appName, "global"), "scoop-hold.txt");
    if (existsSync(globalHoldFile)) {
        return true;
    }

    return false;
}

// Get comprehensive status information for an installed app
export async function getAppStatus(app: InstalledApp): Promise<AppStatus> {
    // Skip the 'scoop' app itself as it's not a regular user-installed app
    if (app.name === "scoop") {
        return null as any; // We'll filter this out later
    }

    const latestVersion = getLatestVersion(app.name);
    const failed = isInstallationFailed(app);
    const deprecated = isAppDeprecated(app.name);
    const removed = isManifestRemoved(app.name);
    const held = isAppHeld(app.name);
    const outdated = compareVersions(app.version, latestVersion);

    const info: string[] = [];
    const missingDeps: string[] = []; // Simplified - could check dependencies

    if (failed) info.push("Install failed");
    if (held) info.push("Held package");
    if (deprecated) info.push("Deprecated");
    if (removed) info.push("Manifest removed");

    return {
        name: app.name,
        installedVersion: app.version,
        latestVersion,
        scope: app.scope,
        outdated,
        failed,
        deprecated,
        removed,
        held,
        missingDeps,
        info,
    };
}

// Check Scoop installation and bucket status using internal methods
export async function checkScoopStatus(local: boolean): Promise<{
    scoopOutdated: boolean;
    bucketsOutdated: boolean;
}> {
    try {
        return await checkInternalStatus(local);
    } catch (e) {
        error("Warning: Could not check status:", e);
        return {
            scoopOutdated: false,
            bucketsOutdated: false,
        };
    }
}

// Format and display status results
export function displayStatus(
    statuses: AppStatus[],
    scoopStatus: { scoopOutdated: boolean; bucketsOutdated: boolean }
): void {
    const { scoopOutdated, bucketsOutdated } = scoopStatus;

    // Display Scoop status first
    if (scoopOutdated) {
        warn("Scoop is out of date. Run 'scoop update' to get the latest version.");
    } else {
        success("Scoop is up to date.");
    }

    // Display bucket status
    if (bucketsOutdated) {
        warn("Bucket(s) are out of date. Run 'scoop update' to get the latest changes.");
    } else {
        success("All buckets are up to date.");
    }

    // Filter for apps that have updates or issues (excluding held packages unless they have other issues)
    const appsWithIssues = statuses.filter(
        s =>
            s.outdated ||
            s.failed ||
            s.deprecated ||
            s.removed ||
            s.missingDeps.length > 0 ||
            (s.held && (s.failed || s.deprecated || s.removed))
    );

    if (appsWithIssues.length === 0) {
        success("All packages are okay and up to date.");
        return;
    }

    newline(); // Empty line before table

    // Calculate column widths - match Scoop's fixed widths
    const nameWidth = 22;
    const installedWidth = 18;
    const latestWidth = 18;
    const missingDepsWidth = 22;

    // Display table header with Scoop-style formatting
    const header =
        "Name".padEnd(nameWidth) +
        "Installed".padEnd(installedWidth) +
        "Latest".padEnd(latestWidth) +
        "Missing Dependencies".padEnd(missingDepsWidth) +
        "Info";

    log(header);
    log("-".repeat(Math.min(header.length, 100))); // Limit separator length

    // Display each app with issues
    for (const status of appsWithIssues) {
        const name =
            status.name.length > nameWidth - 1
                ? status.name.substring(0, nameWidth - 3) + ".."
                : status.name.padEnd(nameWidth);

        const installed =
            (status.installedVersion || "").length > installedWidth - 1
                ? (status.installedVersion || "").substring(0, installedWidth - 3) + ".."
                : (status.installedVersion || "").padEnd(installedWidth);

        const latest =
            (status.outdated ? status.latestVersion || "" : "").length > latestWidth - 1
                ? (status.outdated ? status.latestVersion || "" : "").substring(
                      0,
                      latestWidth - 3
                  ) + ".."
                : (status.outdated ? status.latestVersion || "" : "").padEnd(latestWidth);

        const deps = status.missingDeps.join(" | ");
        const depsFormatted =
            deps.length > missingDepsWidth - 1
                ? deps.substring(0, missingDepsWidth - 3) + ".."
                : deps.padEnd(missingDepsWidth);

        const info = status.info.join(", ");

        log(name + installed + latest + depsFormatted + info);
    }
}

export function displayStatusJson(
    statuses: AppStatus[],
    scoopStatus: { scoopOutdated: boolean; bucketsOutdated: boolean }
): void {
    const { scoopOutdated, bucketsOutdated } = scoopStatus;

    // Filter for apps that have updates or issues
    const appsWithIssues = statuses.filter(
        s =>
            s.outdated ||
            s.failed ||
            s.deprecated ||
            s.removed ||
            s.missingDeps.length > 0 ||
            s.held
    );

    const jsonOutput = {
        scoop: {
            outdated: scoopOutdated,
        },
        buckets: {
            outdated: bucketsOutdated,
        },
        apps: appsWithIssues.map(app => ({
            name: app.name,
            installed_version: app.installedVersion,
            latest_version: app.latestVersion,
            scope: app.scope,
            outdated: app.outdated,
            failed: app.failed,
            deprecated: app.deprecated,
            removed: app.removed,
            held: app.held,
            missing_dependencies: app.missingDeps,
            info: app.info,
        })),
    };

    log(JSON.stringify(jsonOutput, null, 2));
}
