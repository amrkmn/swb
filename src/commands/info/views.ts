import type { Logger } from "src/core/Context";
import type { FoundManifest, InfoFields } from "src/services/ManifestService";
import { dim } from "src/utils/colors";

function formatLine(label: string, value: string): string {
    const maxWidth = 20;
    const padded = label.padEnd(maxWidth, " ");
    return `${padded} : ${value}`;
}

export async function printInfo(
    logger: Logger,
    foundManifest: FoundManifest,
    fields: InfoFields
): Promise<void> {
    const manifest = foundManifest.manifest;
    const log = logger.log.bind(logger);

    const output: string[] = [];

    output.push(formatLine("Name", fields.name));
    output.push(formatLine("Description", fields.description));

    // Version display - show both installed and latest if available
    if (fields.installedVersion && fields.latestVersion) {
        if (fields.updateAvailable) {
            output.push(
                formatLine(
                    "Version",
                    `${fields.installedVersion} -> ${fields.latestVersion} ${dim("(update available)")}`
                )
            );
        } else {
            output.push(formatLine("Version", `${fields.installedVersion} ${dim("(up to date)")}`));
        }
    } else if (fields.installedVersion) {
        output.push(formatLine("Installed version", fields.installedVersion));
        output.push(formatLine("Status", "No bucket info available"));
    } else if (fields.latestVersion) {
        output.push(formatLine("Latest version", fields.latestVersion));
        output.push(formatLine("Status", "Not installed"));
    } else {
        output.push(formatLine("Version", fields.version));
    }

    output.push(formatLine("Homepage", fields.homepage));

    // License information
    if (fields.license) {
        if (typeof fields.license === "string") {
            output.push(formatLine("License", fields.license));
        } else if (typeof fields.license === "object" && fields.license.identifier) {
            const licenseInfo = fields.license.url
                ? `${fields.license.identifier} (${fields.license.url})`
                : fields.license.identifier;
            output.push(formatLine("License", licenseInfo));
        }
    } else if (manifest.license) {
        const license =
            typeof manifest.license === "string"
                ? manifest.license
                : typeof manifest.license === "object" && manifest.license.identifier
                  ? manifest.license.identifier
                  : JSON.stringify(manifest.license);
        output.push(formatLine("License", license));
    }

    // Installation status and source information
    const isInstalled = foundManifest.source === "installed";
    output.push(formatLine("Installed", isInstalled ? "Yes" : "No"));

    if (foundManifest.source === "bucket" && foundManifest.bucket) {
        output.push(
            formatLine("Bucket", `${foundManifest.bucket} ${dim(`(${foundManifest.scope} scope)`)}`)
        );
        output.push(formatLine("Manifest", foundManifest.filePath));
    } else {
        if (fields.source && fields.source !== "installed") {
            output.push(
                formatLine(
                    "Installed from",
                    `${fields.source} ${dim(`(${foundManifest.scope} scope)`)}`
                )
            );
        } else {
            output.push(formatLine("Installed in", `${foundManifest.scope} scope`));
        }
        output.push(formatLine("Location", foundManifest.filePath));
    }

    // Architecture support
    if (manifest.architecture && typeof manifest.architecture === "object") {
        const archs = Object.keys(manifest.architecture);
        if (archs.length > 0) {
            output.push(formatLine("Architecture", archs.join(", ")));
        }
    }

    // Runtime dependencies
    if (manifest.depends) {
        const deps: string[] = Array.isArray(manifest.depends)
            ? manifest.depends
            : [manifest.depends];
        output.push(formatLine("Dependencies", deps.join(", ")));
    }

    // Optional suggestions
    if (manifest.suggest && typeof manifest.suggest === "object") {
        output.push("Suggestions:");
        Object.entries(manifest.suggest).forEach(([feature, apps]: [string, any]) => {
            const appsList = Array.isArray(apps) ? apps : [apps];
            output.push(`  ${formatLine(feature, appsList.join(", "))}`);
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
        output.push(formatLine("Binaries", binNames.join(", ")));
    }

    // Environment modifications
    if (manifest.env_add_path) {
        const paths: string[] = Array.isArray(manifest.env_add_path)
            ? manifest.env_add_path
            : [manifest.env_add_path];
        output.push(formatLine("Adds to PATH", paths.join(", ")));
    }

    if (manifest.env_set && typeof manifest.env_set === "object") {
        output.push("Environment variables:");
        Object.entries(manifest.env_set).forEach(([key, value]) => {
            output.push(`  ${formatLine(key, String(value))}`);
        });
    }

    // Shortcuts
    if (manifest.shortcuts && Array.isArray(manifest.shortcuts)) {
        const shortcutNames: string[] = manifest.shortcuts.map((shortcut: any) =>
            Array.isArray(shortcut) && shortcut[1] ? shortcut[1] : "shortcut"
        );
        output.push(formatLine("Creates shortcuts", shortcutNames.join(", ")));
    }

    // Persistence
    if (manifest.persist) {
        const persistItems: string[] = Array.isArray(manifest.persist)
            ? manifest.persist
            : [manifest.persist];
        output.push(formatLine("Persisted data", persistItems.join(", ")));
    }

    // Notes
    if (manifest.notes && (typeof manifest.notes === "string" || Array.isArray(manifest.notes))) {
        const notes = Array.isArray(manifest.notes) ? manifest.notes.join(" ") : manifest.notes;
        output.push(formatLine("Notes", notes));
    }

    // Deprecation warning
    if (fields.deprecated) {
        output.push(formatLine("Status", "DEPRECATED"));
        if (manifest.deprecated_by) {
            output.push(formatLine("Replaced by", manifest.deprecated_by));
        }
    }

    // Comments (## property)
    if (manifest["##"]) {
        const comments = Array.isArray(manifest["##"]) ? manifest["##"] : [manifest["##"]];
        output.push("Comments:");
        comments.forEach((comment: string) => output.push(`  ${comment}`));
    }

    // Print output
    output.forEach(line => log(line));
}
