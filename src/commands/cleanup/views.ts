import { type CleanupResult } from "src/services/CleanupService";
import { dim, green } from "src/utils/colors";
import type { Logger } from "src/core/Context";

/**
 * Format bytes to human-readable size
 */
function formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function displayAppCleanupResult(logger: Logger, result: CleanupResult, maxWidth = 0): void {
    const scopeStr = result.scope === "global" ? " (global)" : "";

    if (
        result.oldVersions.length === 0 &&
        result.cacheFiles.length === 0 &&
        result.failedVersions.length === 0
    ) {
        return;
    }

    // Build version string (join with comma)
    const versions = result.oldVersions.map(v => v.version).join(", ");

    // Calculate total space freed
    const versionsSpace = result.oldVersions.reduce((sum, v) => sum + v.size, 0);
    const cacheSpace = result.cacheFiles.reduce((sum, c) => sum + c.size, 0);
    const totalSpace = versionsSpace + cacheSpace;

    const freedStr = totalSpace > 0 ? ` (${dim(formatSize(totalSpace))})` : "";

    // Pad app name to align columns
    let paddedName = result.app;

    if (maxWidth > 0) {
        const currentWidth = result.app.length;
        const spacesToAdd = maxWidth - currentWidth;
        if (spacesToAdd > 0) {
            paddedName = result.app + " ".repeat(spacesToAdd);
        }
    }

    logger.log(`${paddedName} : ${versions}${freedStr}${scopeStr}`);
}

export function displayCleanupSummary(logger: Logger, results: CleanupResult[]): void {
    let totalVersionsRemoved = 0;
    let totalVersionsFailed = 0;
    let totalCacheFilesRemoved = 0;
    let totalVersionsSpace = 0;
    let totalCacheSpace = 0;

    for (const result of results) {
        totalVersionsRemoved += result.oldVersions.length;
        totalVersionsFailed += result.failedVersions.length;
        totalCacheFilesRemoved += result.cacheFiles.length;
        totalVersionsSpace += result.oldVersions.reduce((sum, v) => sum + v.size, 0);
        totalCacheSpace += result.cacheFiles.reduce((sum, c) => sum + c.size, 0);
    }

    const hasActivity =
        totalVersionsRemoved > 0 || totalCacheFilesRemoved > 0 || totalVersionsFailed > 0;

    if (!hasActivity) {
        logger.log("");
        logger.info("Nothing to clean up.");
        return;
    }

    logger.log("");
    if (totalVersionsRemoved > 0 || totalCacheFilesRemoved > 0) {
        logger.success("Cleanup complete");
        if (totalVersionsRemoved > 0) {
            logger.log(
                `  ${"Old versions removed:"} ${totalVersionsRemoved} (${dim(formatSize(totalVersionsSpace))})`
            );
        }
        if (totalCacheFilesRemoved > 0) {
            logger.log(
                `  ${"Cache files removed:"} ${totalCacheFilesRemoved} (${dim(formatSize(totalCacheSpace))})`
            );
        }
        logger.log(
            `  ${"Total space freed:"} ${green(formatSize(totalVersionsSpace + totalCacheSpace))}`
        );
    }

    if (totalVersionsFailed > 0) {
        logger.log("");
        logger.warn(
            `${totalVersionsFailed} version(s) could not be removed (likely in use or locked)`
        );
        logger.info("Tip: Close running apps and try again, or run as administrator if needed.");
    }
}
