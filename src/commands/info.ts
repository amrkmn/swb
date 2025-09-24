import { findAllManifests, type FoundManifest, readManifestFields } from "../lib/manifests.ts";
import type { CommandDefinition, ParsedArgs } from "../lib/parser.ts";

async function printInfo(foundManifest: FoundManifest, verbose: boolean): Promise<void> {
    const fields = readManifestFields(foundManifest.app, foundManifest);
    const manifest = foundManifest.manifest;

    // Header with basic information
    console.log(`Name: ${fields.name}`);
    console.log(`Description: ${fields.description}`);
    console.log(`Version: ${fields.version}`);
    console.log(`Homepage: ${fields.homepage}`);

    // License information (required property - can be string or object with identifier/url)
    if (fields.license) {
        if (typeof fields.license === "string") {
            console.log(`License: ${fields.license}`);
        } else if (typeof fields.license === "object" && fields.license.identifier) {
            const licenseInfo = fields.license.url
                ? `${fields.license.identifier} (${fields.license.url})`
                : fields.license.identifier;
            console.log(`License: ${licenseInfo}`);
        }
    } else if (manifest.license) {
        // Fallback for direct manifest access
        const license =
            typeof manifest.license === "string"
                ? manifest.license
                : typeof manifest.license === "object" && manifest.license.identifier
                ? manifest.license.identifier
                : JSON.stringify(manifest.license);
        console.log(`License: ${license}`);
    }

    // Installation status and source information
    const isInstalled = foundManifest.source === "installed";
    console.log(`Installed: ${isInstalled ? "Yes" : "No"}`);

    if (foundManifest.source === "bucket") {
        console.log(`Bucket: ${foundManifest.bucket} (${foundManifest.scope} scope)`);
        console.log(`Manifest: ${foundManifest.filePath}`);
    } else {
        // For installed apps, show bucket info if available
        if (fields.source && fields.source !== "installed") {
            console.log(`Installed from: ${fields.source} bucket (${foundManifest.scope} scope)`);
        } else {
            console.log(`Installed in: ${foundManifest.scope} scope`);
        }
        console.log(`Location: ${foundManifest.filePath}`);
    }

    // Status and deprecation warnings
    if (fields.deprecated) {
        console.log(`⚠️  Status: DEPRECATED`);
        if (manifest.deprecated_by) {
            console.log(`   Replaced by: ${manifest.deprecated_by}`);
        }
    }

    // Comments (## property)
    if (manifest["##"]) {
        const comments = Array.isArray(manifest["##"]) ? manifest["##"] : [manifest["##"]];
        console.log(`Comments:`);
        comments.forEach((comment: string) => console.log(`  ${comment}`));
    }

    // Architecture support (official Scoop manifest field)
    if (manifest.architecture && typeof manifest.architecture === "object") {
        const archs = Object.keys(manifest.architecture);
        if (archs.length > 0) {
            console.log(`Architecture: ${archs.join(", ")}`);
        }
    }

    // Runtime dependencies (official Scoop manifest field - required)
    if (manifest.depends) {
        const deps = Array.isArray(manifest.depends) ? manifest.depends : [manifest.depends];
        console.log(`Dependencies: ${deps.join(", ")}`);
    }

    // Optional suggestions for complementary features (official Scoop manifest field)
    if (manifest.suggest && typeof manifest.suggest === "object") {
        console.log(`Suggestions:`);
        Object.entries(manifest.suggest).forEach(([feature, apps]: [string, any]) => {
            const appsList = Array.isArray(apps) ? apps : [apps];
            console.log(`  ${feature}: ${appsList.join(", ")}`);
        });
    }

    // Executables (bin field from Scoop manifest schema)
    if (manifest.bin) {
        const binaries = Array.isArray(manifest.bin) ? manifest.bin : [manifest.bin];
        const binNames = binaries.map((bin: any) =>
            typeof bin === "string"
                ? bin.split(/[/\\]/).pop()
                : Array.isArray(bin) && bin.length > 1
                ? bin[1]
                : Array.isArray(bin)
                ? bin[0].split(/[/\\]/).pop()
                : bin.toString()
        );
        console.log(`Binaries: ${binNames.join(", ")}`);
    }

    // Environment modifications (official Scoop manifest properties)
    if (manifest.env_add_path) {
        const paths = Array.isArray(manifest.env_add_path) ? manifest.env_add_path : [manifest.env_add_path];
        console.log(`Adds to PATH: ${paths.join(", ")}`);
    }

    if (manifest.env_set && typeof manifest.env_set === "object") {
        console.log(`Environment variables:`);
        Object.entries(manifest.env_set).forEach(([key, value]) => {
            console.log(`  ${key} = ${value}`);
        });
    }

    // PowerShell module installation (official Scoop manifest property)
    if (manifest.psmodule) {
        console.log(`PowerShell module: ${manifest.psmodule.name || "yes"}`);
    }

    // Shortcuts (official Scoop manifest field)
    if (manifest.shortcuts && Array.isArray(manifest.shortcuts)) {
        const shortcutNames = manifest.shortcuts.map((shortcut: any) =>
            Array.isArray(shortcut) && shortcut[1] ? shortcut[1] : "shortcut"
        );
        console.log(`Creates shortcuts: ${shortcutNames.join(", ")}`);
    }

    // Persistence (official Scoop manifest field)
    if (manifest.persist) {
        const persistItems = Array.isArray(manifest.persist) ? manifest.persist : [manifest.persist];
        console.log(`Persisted data: ${persistItems.join(", ")}`);
    }

    // Installation/extraction info
    if (manifest.extract_dir && !verbose) {
        console.log(`Extract directory: ${manifest.extract_dir}`);
    }

    // Auto-update capability (official Scoop manifest field)
    if (manifest.checkver && !verbose) {
        console.log(`Auto-update: Enabled`);
    }

    // Notes (official Scoop manifest field)
    if (manifest.notes && (typeof manifest.notes === "string" || Array.isArray(manifest.notes))) {
        const notes = Array.isArray(manifest.notes) ? manifest.notes.join(" ") : manifest.notes;
        console.log(`Notes: ${notes}`);
    }

    // Verbose mode: Show detailed manifest information
    if (verbose) {
        console.log("\n=== DETAILED INFORMATION ===");

        // Download URLs and hashes
        if (manifest.url) {
            const urls = Array.isArray(manifest.url) ? manifest.url : [manifest.url];
            console.log(`Download URLs:`);
            urls.forEach((url: any, i: number) => console.log(`  ${i + 1}. ${url}`));
        }

        if (manifest.hash) {
            const hashes = Array.isArray(manifest.hash) ? manifest.hash : [manifest.hash];
            console.log(`File hashes:`);
            hashes.forEach((hash: any, i: number) => console.log(`  ${i + 1}. ${hash}`));
        }

        // Installer/uninstaller configuration
        if (manifest.installer) {
            console.log(`Installer config: ${JSON.stringify(manifest.installer, null, 2)}`);
        }

        if (manifest.uninstaller) {
            console.log(`Uninstaller config: ${JSON.stringify(manifest.uninstaller, null, 2)}`);
        }

        // Pre/post install scripts
        const scriptFields = ["pre_install", "post_install", "pre_uninstall", "post_uninstall"];
        for (const field of scriptFields) {
            if (manifest[field]) {
                const scripts = Array.isArray(manifest[field]) ? manifest[field] : [manifest[field]];
                console.log(`${field.replace("_", " ")}: ${scripts.join("; ")}`);
            }
        }

        // Auto-update details
        if (manifest.checkver) {
            console.log(`Version check config: ${JSON.stringify(manifest.checkver, null, 2)}`);
        }

        if (manifest.autoupdate) {
            console.log(`Auto-update config: ${JSON.stringify(manifest.autoupdate, null, 2)}`);
        }

        // Architecture-specific details
        if (manifest.architecture) {
            console.log(`Architecture-specific configs:`);
            for (const [arch, config] of Object.entries(manifest.architecture)) {
                console.log(`  ${arch}: ${JSON.stringify(config, null, 4)}`);
            }
        }

        console.log("\n=== COMPLETE MANIFEST ===");
        console.log(JSON.stringify(manifest, null, 2));
    }
}

// New style command definition
export const definition: CommandDefinition = {
    name: "info",
    description: "Show detailed info about an app",
    arguments: [
        {
            name: "app",
            description: "App name, optionally bucket/app",
            required: true,
        },
    ],
    options: [
        {
            flags: "--verbose",
            description: "Show extra diagnostics",
        },
    ],
    handler: async (args: ParsedArgs): Promise<number> => {
        try {
            const appInput = args.args[0];
            if (!appInput) {
                console.error("App name is required");
                return 1;
            }

            const verbose = Boolean(args.flags.verbose || args.global.verbose);

            // Search comprehensively for the app across all buckets and scopes
            const results = findAllManifests(appInput);

            if (results.length === 0) {
                console.error(`Could not find '${appInput}' in installed apps or local buckets.`);
                console.log(`\nTip: Try 'swb search ${appInput}' to find similar apps or check if buckets are up to date.`);
                return 1;
            }

            // Show the primary result (prefer installed if available)
            const primary = results.find((r) => r.source === "installed") || results[0];
            await printInfo(primary, verbose);

            return 0;
        } catch (error) {
            console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
            return 1;
        }
    },
};
