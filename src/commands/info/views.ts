import type { Logger } from "src/core/Context";
import type { FoundManifest, InfoFields } from "src/services/ManifestService";
import {
    blue,
    bold,
    cyan,
    dim,
    gray,
    green,
    info,
    magenta,
    red,
    underline,
    white,
    yellow,
} from "src/utils/colors";

export async function printInfo(
    logger: Logger,
    foundManifest: FoundManifest,
    fields: InfoFields,
    verbose: boolean
): Promise<void> {
    const manifest = foundManifest.manifest;
    const log = logger.log.bind(logger);
    const warn = logger.warn.bind(logger);

    // Header with basic information
    log(`${bold(white("Name:"))}: ${bold(cyan(fields.name))}`);
    log(`${bold(white("Description:"))}: ${white(fields.description)}`);
    log(`${bold(white("Version:"))}: ${green(fields.version)}`);
    log(`${bold(white("Homepage:"))}: ${info(fields.homepage)}`);

    // License information
    if (fields.license) {
        if (typeof fields.license === "string") {
            log(`${bold(white("License:"))}: ${white(fields.license)}`);
        } else if (typeof fields.license === "object" && fields.license.identifier) {
            const licenseInfo = fields.license.url
                ? `${fields.license.identifier} (${fields.license.url})`
                : fields.license.identifier;
            log(`${bold(white("License:"))}: ${white(licenseInfo)}`);
        }
    } else if (manifest.license) {
        // Fallback for direct manifest access
        const license =
            typeof manifest.license === "string"
                ? manifest.license
                : typeof manifest.license === "object" && manifest.license.identifier
                  ? manifest.license.identifier
                  : JSON.stringify(manifest.license);
        log(`${bold(white("License:"))}: ${white(license)}`);
    }

    // Installation status and source information
    const isInstalled = foundManifest.source === "installed";
    log(`${bold(white("Installed:"))}: ${isInstalled ? green("Yes") : red("No")}`);

    if (foundManifest.source === "bucket" && foundManifest.bucket) {
        log(
            `${bold(white("Bucket:"))}: ${magenta(foundManifest.bucket)} ${dim(`(${foundManifest.scope} scope)`)}`
        );
        log(`${bold(white("Manifest:"))}: ${gray(foundManifest.filePath)}`);
    } else {
        // For installed apps, show bucket info if available
        if (fields.source && fields.source !== "installed") {
            log(
                `${bold(white("Installed from:"))}: ${magenta(fields.source)} bucket ${dim(`(${foundManifest.scope} scope)`)}`
            );
        } else {
            log(`${bold(white("Installed in:"))}: ${dim(`${foundManifest.scope} scope`)}`);
        }
        log(`${bold(white("Location:"))}: ${gray(foundManifest.filePath)}`);
    }

    // Status and deprecation warnings
    if (fields.deprecated) {
        warn(`Status: DEPRECATED`);
        if (manifest.deprecated_by) {
            log(`   ${bold(white("Replaced by:"))}: ${bold(cyan(manifest.deprecated_by))}`);
        }
    }

    // Comments (## property)
    if (manifest["##"]) {
        const comments = Array.isArray(manifest["##"]) ? manifest["##"] : [manifest["##"]];
        log(`${bold(white("Comments:"))}`);
        comments.forEach((comment: string) => log(`  ${dim(comment)}`));
    }

    // Architecture support
    if (manifest.architecture && typeof manifest.architecture === "object") {
        const archs = Object.keys(manifest.architecture);
        if (archs.length > 0) {
            log(`${bold(white("Architecture:"))}: ${white(archs.join(", "))}`);
        }
    }

    // Runtime dependencies
    if (manifest.depends) {
        const deps: string[] = Array.isArray(manifest.depends)
            ? manifest.depends
            : [manifest.depends];
        log(`${bold(white("Dependencies:"))}: ${deps.map(dep => bold(cyan(dep))).join(", ")}`);
    }

    // Optional suggestions
    if (manifest.suggest && typeof manifest.suggest === "object") {
        log(`${bold(white("Suggestions:"))}`);
        Object.entries(manifest.suggest).forEach(([feature, apps]: [string, any]) => {
            const appsList = Array.isArray(apps) ? apps : [apps];
            log(
                `  ${bold(white(feature + ":"))}: ${appsList.map(app => bold(cyan(app))).join(", ")}`
            );
        });
    }

    // Binaries
    if (manifest.bin) {
        const binaries = Array.isArray(manifest.bin) ? manifest.bin : [manifest.bin];
        const binNames: string[] = binaries.map((bin: any) =>
            typeof bin === "string"
                ? bin.split(/[/\\]/).pop()
                : Array.isArray(bin) && bin.length > 1
                  ? bin[1]
                  : Array.isArray(bin)
                    ? bin[0].split(/[/\\]/).pop()
                    : bin.toString()
        );
        log(`${bold(white("Binaries:"))}: ${binNames.map(name => green(name)).join(", ")}`);
    }

    // Environment modifications
    if (manifest.env_add_path) {
        const paths: string[] = Array.isArray(manifest.env_add_path)
            ? manifest.env_add_path
            : [manifest.env_add_path];
        log(`${bold(white("Adds to PATH:"))}: ${paths.map(path => gray(path)).join(", ")}`);
    }

    if (manifest.env_set && typeof manifest.env_set === "object") {
        log(`${bold(white("Environment variables:"))}`);
        Object.entries(manifest.env_set).forEach(([key, value]) => {
            log(`  ${bold(white(key))} = ${white(String(value))}`);
        });
    }

    // Shortcuts
    if (manifest.shortcuts && Array.isArray(manifest.shortcuts)) {
        const shortcutNames: string[] = manifest.shortcuts.map((shortcut: any) =>
            Array.isArray(shortcut) && shortcut[1] ? shortcut[1] : "shortcut"
        );
        log(
            `${bold(white("Creates shortcuts:"))}: ${shortcutNames.map(name => bold(cyan(name))).join(", ")}`
        );
    }

    // Persistence
    if (manifest.persist) {
        const persistItems: string[] = Array.isArray(manifest.persist)
            ? manifest.persist
            : [manifest.persist];
        log(
            `${bold(white("Persisted data:"))}: ${persistItems.map(item => gray(String(item))).join(", ")}`
        );
    }

    // Notes
    if (manifest.notes && (typeof manifest.notes === "string" || Array.isArray(manifest.notes))) {
        const notes = Array.isArray(manifest.notes) ? manifest.notes.join(" ") : manifest.notes;
        log(`${bold(white("Notes:"))}: ${yellow(notes)}`);
    }

    // Verbose mode
    if (verbose) {
        log(`\n${bold(underline("=== DETAILED INFORMATION ==="))}`);

        if (manifest.url) {
            const urls = Array.isArray(manifest.url) ? manifest.url : [manifest.url];
            log(`${bold(white("Download URLs:"))}`);
            urls.forEach((url: any, i: number) => log(`  ${dim(`${i + 1}.`)} ${blue(url)}`));
        }

        if (manifest.hash) {
            const hashes = Array.isArray(manifest.hash) ? manifest.hash : [manifest.hash];
            log(`${bold(white("File hashes:"))}`);
            hashes.forEach((hash: any, i: number) => log(`  ${dim(`${i + 1}.`)} ${dim(hash)}`));
        }

        if (manifest.installer) {
            log(
                `${bold(white("Installer config:"))}: ${dim(JSON.stringify(manifest.installer, null, 2))}`
            );
        }

        log(`\n${bold(underline("=== COMPLETE MANIFEST ==="))}`);
        log(dim(JSON.stringify(manifest, null, 2)));
    }
}
