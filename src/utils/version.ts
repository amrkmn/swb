/**
 * Version retrieval utility
 * Handles both compiled (SWB_VERSION) and development (package.json) environments.
 */

// Declared in scripts/build.ts via "define"
declare const SWB_VERSION: string | undefined;

export async function getVersion(): Promise<string> {
    // Check if SWB_VERSION was injected during build
    if (typeof SWB_VERSION !== "undefined") {
        return SWB_VERSION;
    }

    // Fallback to reading from package.json (development mode)
    try {
        // Resolve package.json relative to this file (src/utils/version.ts -> ../../package.json)
        const pkgPath = new URL("../../package.json", import.meta.url);
        const pkg = await Bun.file(pkgPath).json();
        return pkg.version || "unknown";
    } catch {
        return "unknown";
    }
}
