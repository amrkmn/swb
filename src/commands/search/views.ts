import type { Logger } from "src/core/Context";
import type { SearchResult } from "src/services/WorkerService";
import { blue, bold, cyan, dim, green, yellow } from "src/utils/colors";

/**
 * Format and display search results
 */
export function formatSearchResults(
    logger: Logger,
    results: SearchResult[],
    isVerbose: boolean
): void {
    if (results.length === 0) {
        logger.warn("No packages found.");
        return;
    }

    // Group by bucket
    const bucketGroups = new Map<string, SearchResult[]>();
    for (const result of results) {
        if (!bucketGroups.has(result.bucket)) {
            bucketGroups.set(result.bucket, []);
        }
        bucketGroups.get(result.bucket)!.push(result);
    }

    // Sort buckets and display
    const sortedBuckets = Array.from(bucketGroups.entries()).sort(([a], [b]) => a.localeCompare(b));

    for (let i = 0; i < sortedBuckets.length; i++) {
        const [bucketName, bucketResults] = sortedBuckets[i];
        logger.log(`${i === 0 ? "" : "\n"}${yellow(`'${bucketName}' bucket:`)}`);

        // Sort results within bucket (installed first, then alphabetical)
        bucketResults.sort((a, b) => {
            if (a.isInstalled !== b.isInstalled) {
                return a.isInstalled ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        for (const result of bucketResults) {
            let line = `    ${bold(cyan(result.name))}`;

            if (result.version) {
                line += ` ${dim(`(${green(result.version)})`)}`;
            }

            if (result.isInstalled) {
                line += ` ${green("[installed]")}`;
            }

            logger.log(line);

            if (isVerbose && result.description) {
                logger.log(`        ${dim(result.description)}`);
            }

            if (isVerbose && result.binaries && result.binaries.length > 0) {
                const binariesText = result.binaries.map(bin => green(bin.trim())).join("', '");
                logger.log(`        ${dim("-->")} includes '${binariesText}'`);
            }
        }
    }

    logger.log(`\n${blue(`Found ${results.length} package(s).`)}`);
}
