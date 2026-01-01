/**
 * Worker path resolution for development and compiled contexts
 */

// Declare the compile-time constant that gets injected during build
declare const SWB_WORKER_PATH: string | undefined;

/**
 * Get the worker URL for a specific worker file
 * @param workerName - The worker filename without extension (e.g., "search", "status")
 * @returns The full URL/path to the worker file
 */
export function getWorkerUrl(workerName: string): string {
    // Check if running from compiled executable with embedded worker
    if (typeof SWB_WORKER_PATH !== "undefined") {
        return `${SWB_WORKER_PATH}/${workerName}.js`;
    }

    // Development mode - use .ts file
    return new URL(`./${workerName}.ts`, import.meta.url).href;
}
