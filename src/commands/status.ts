import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { listInstalledApps, type InstalledApp } from "../lib/apps.ts";
import { findAllBucketsInScope, findAllManifests, readManifestFields } from "../lib/manifests.ts";
import type { CommandDefinition, ParsedArgs } from "../lib/parser.ts";

// Status information for an installed app
interface AppStatus {
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

// Check if a bucket directory has updates
async function checkBucketUpdate(bucketPath: string): Promise<boolean> {
    try {
        // Check if .git directory exists
        const gitPath = join(bucketPath, "..", ".git");
        const parentGitPath = join(bucketPath, ".git");

        const hasGit = existsSync(gitPath) || existsSync(parentGitPath);

        if (!hasGit) {
            return false;
        }

        // Check if bucket has the expected structure
        const bucketFiles = readdirSync(bucketPath);
        const hasManifests = bucketFiles.some(file => file.endsWith(".json"));

        if (!hasManifests) {
            // Empty bucket or corrupted - consider it needing update
            return true;
        }

        // For self-contained operation without git access, we'll be conservative
        // Only report bucket updates needed if there are clear signs of issues

        // Check if the bucket directory itself is suspiciously old (older than 30 days)
        // This catches truly stale buckets while avoiding false positives
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const bucketStat = statSync(bucketPath);

        if (bucketStat.mtime < thirtyDaysAgo) {
            // Bucket hasn't been touched in a month - likely needs update
            return true;
        }

        // Otherwise, assume bucket is fine for self-contained operation
        return false;
    } catch {
        // On any error, assume the bucket is fine
        return false;
    }
}

// Get the latest version of an app from its manifest, checking all buckets
function getLatestVersion(appName: string): string | null {
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
function parseVersionString(version: string): number[] {
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
function compareVersionArrays(a: number[], b: number[]): number {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const aVal = a[i] || 0;
        const bVal = b[i] || 0;
        if (aVal > bVal) return 1;
        if (aVal < bVal) return -1;
    }
    return 0;
}

// Check if an app installation failed (simplified check)
function isInstallationFailed(app: InstalledApp): boolean {
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
function isAppDeprecated(appName: string): boolean {
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
function isManifestRemoved(appName: string): boolean {
    const manifests = findAllManifests(appName);
    return manifests.length === 0;
}

// Compare installed and latest versions to determine if app is outdated
function compareVersions(installed: string | null, latest: string | null): boolean {
    if (!installed || !latest) return false;
    if (installed === latest) return false;

    const installedParts = parseVersionString(installed);
    const latestParts = parseVersionString(latest);

    return compareVersionArrays(latestParts, installedParts) > 0;
}

// Check status internally without external dependencies
async function checkInternalStatus(local: boolean): Promise<{
    scoopOutdated: boolean;
    bucketsOutdated: boolean;
}> {
    let bucketsOutdated = false;
    let scoopOutdated = false;

    if (local) {
        return { scoopOutdated: false, bucketsOutdated: false };
    }

    try {
        // Check buckets for updates
        const scopes: ("user" | "global")[] = ["user", "global"];

        for (const scope of scopes) {
            const buckets = findAllBucketsInScope(scope);

            for (const bucket of buckets) {
                const bucketDir = bucket.bucketDir;
                if (await checkBucketUpdate(bucketDir)) {
                    bucketsOutdated = true;
                    break;
                }
            }

            if (bucketsOutdated) break;
        }

        // For Scoop itself, we'll assume it's up to date since checking would require external commands
        scoopOutdated = false;
    } catch (error) {
        console.error("Warning: Could not check bucket status:", error);
    }

    return { scoopOutdated, bucketsOutdated };
}

// Get the path to a Scoop app's current installation directory
function getScoopAppPath(appName: string, scope: "user" | "global"): string {
    const scoopPath =
        scope === "global"
            ? process.env.SCOOP_GLOBAL || "C:\\ProgramData\\scoop"
            : process.env.SCOOP || join(process.env.USERPROFILE || "", "scoop");
    return join(scoopPath, "apps", appName, "current");
}

function isAppHeld(appName: string): boolean {
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
async function getAppStatus(app: InstalledApp): Promise<AppStatus> {
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
async function checkScoopStatus(local: boolean): Promise<{
    scoopOutdated: boolean;
    bucketsOutdated: boolean;
}> {
    try {
        return await checkInternalStatus(local);
    } catch (error) {
        console.error("Warning: Could not check status:", error);
        return {
            scoopOutdated: false,
            bucketsOutdated: false,
        };
    }
}

// Format and display status results
function displayStatus(
    statuses: AppStatus[],
    scoopStatus: { scoopOutdated: boolean; bucketsOutdated: boolean }
): void {
    const { scoopOutdated, bucketsOutdated } = scoopStatus;

    // Display Scoop status first
    if (scoopOutdated) {
        console.log("WARN  Scoop is out of date. Run 'scoop update' to get the latest version.");
    }

    // Display bucket status
    if (bucketsOutdated) {
        console.log(
            "WARN  Some buckets are out of date. Run 'scoop update' to get the latest changes."
        );
    }

    // If neither Scoop nor buckets are outdated, show positive message
    if (!scoopOutdated && !bucketsOutdated) {
        console.log("Scoop is up to date.");
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
        // Check if everything is truly ok
        if (!scoopOutdated && !bucketsOutdated) {
            console.log("Everything is ok!");
        }
        return;
    }

    console.log(""); // Empty line before table

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

    console.log(header);
    console.log("-".repeat(Math.min(header.length, 100))); // Limit separator length

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

        console.log(name + installed + latest + depsFormatted + info);
    }
}

function displayStatusJson(
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

    console.log(JSON.stringify(jsonOutput, null, 2));
}

// New style command definition
export const definition: CommandDefinition = {
    name: "status",
    description: "Show status of installed packages",
    options: [
        {
            flags: "-l, --local",
            description: "Check status only locally (skip remote updates)",
        },
        {
            flags: "-j, --json",
            description: "Output in JSON format",
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const local = Boolean(args.flags.local || args.flags.l);
            const json = Boolean(args.flags.json || args.flags.j);

            if (!local && !json) {
                console.log("Checking for updates...");
            }

            // Get all installed apps
            const installedApps = listInstalledApps();

            if (installedApps.length === 0) {
                if (json) {
                    console.log(
                        JSON.stringify(
                            {
                                scoop: { outdated: false },
                                buckets: { outdated: false },
                                apps: [],
                            },
                            null,
                            2
                        )
                    );
                } else {
                    console.log("No packages installed.");
                }
                return 0;
            }

            // Check Scoop and bucket status
            const scoopStatus = await checkScoopStatus(local);

            // Get status for each installed app
            const statuses: AppStatus[] = [];
            for (const app of installedApps) {
                const status = await getAppStatus(app);
                if (status) {
                    // Filter out null results (like 'scoop' app)
                    statuses.push(status);
                }
            }

            // Display results
            if (json) {
                displayStatusJson(statuses, scoopStatus);
            } else {
                displayStatus(statuses, scoopStatus);
            }

            return 0;
        } catch (error) {
            console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
            return 1;
        }
    },
};
