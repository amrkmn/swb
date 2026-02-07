#!/usr/bin/env bun
import { $ } from "bun";

const command = process.argv[2];
if (!command) {
    console.error("Usage: bun run .github/scripts/release.ts <command> [options]");
    console.error("Commands:");
    console.error("  build --platform <name> <version>  - Build and upload release assets");
    console.error("  json <version>                       - Generate latest.json from release");
    process.exit(1);
}

const version = process.argv[process.argv.length - 1];
if (!version) {
    console.error("Error: Version is required");
    process.exit(1);
}

const repoName = process.env.GITHUB_REPOSITORY || "amrkmn/swb";
const token = process.env.GITHUB_TOKEN;

if (!token) {
    console.error("GITHUB_TOKEN environment variable is required");
    process.exit(1);
}

const args = process.argv.slice(3, process.argv.length - 1);
const platformArgIndex = args.indexOf("--platform");
const platform = platformArgIndex !== -1 ? args[platformArgIndex + 1] : "windows-x64";

async function buildAndUpload(): Promise<void> {
    console.log(`Building version ${version} (platform: ${platform})...`);

    // Set version environment variable
    process.env.SWB_VERSION = version;

    // Install dependencies
    await $`bun install --frozen-lockfile`;

    // Build executable with appropriate flags based on platform
    const buildArgs = platform.includes("-baseline") ? ["--baseline"] : [];
    await $`bun run build ${buildArgs}`.env(process.env);

    // Create release archive
    const dirname = `swb-v${version}-${platform}`;
    const zipname = `${dirname}.zip`;

    console.log(`Creating archive: ${zipname}`);

    // Create directory structure
    await $`mkdir -p dist/${dirname}`;

    // Copy files into directory
    await $`cp dist/swb.exe dist/${dirname}/`;
    await $`cp README.md dist/${dirname}/`;
    await $`cp LICENSE dist/${dirname}/`;

    // Create zip with directory structure
    await $`cd dist && zip -r ${zipname} ${dirname}`;

    // Clean up temporary directory
    await $`rm -rf dist/${dirname}`;

    // Calculate hash and size locally for fallback
    const basename = `dist/${zipname}`;
    const hashOutput = await $`sha256sum ${basename}`.quiet().text();
    const hash = hashOutput.trim().split(/\s+/)[0];
    const statOutput = await $`stat -c%s ${basename}`.quiet().text();
    const size = parseInt(statOutput.trim(), 10);

    // Save metadata as artifact for fallback
    const metadata = {
        version,
        platform,
        filename: zipname,
        hash,
        size,
    };
    await $`mkdir -p artifacts`.quiet();
    await Bun.write(`artifacts/${platform}-metadata.json`, JSON.stringify(metadata, null, 2));
    console.log(`Saved metadata: ${platform}-metadata.json`);

    // Upload to release
    console.log(`Uploading ${basename} to v${version}...`);
    await $`gh release upload v${version} ${basename} --clobber`;

    console.log("Build and upload complete!");
}

async function generateLatestJson(): Promise<void> {
    console.log(`Generating latest.json for version ${version}...`);

    interface PlatformMetadata {
        filename: string;
        hash: string;
        size: number;
    }

    type MetadataMap = Record<string, PlatformMetadata | null>;

    const metadata: MetadataMap = {};

    // Extract platform name from zip filename pattern: swb-v{version}-{platform}.zip
    const extractPlatform = (filename: string): string | null => {
        const match = filename.match(new RegExp(`^swb-v${version}-(.+)\.zip$`));
        return match ? match[1] : null;
    };

    // Try GitHub API first
    try {
        const assetsJson =
            await $`gh api repos/${repoName}/releases/tags/v${version} --json assets --jq '.assets[] | select(.name | endswith(".zip") and (contains(".sha256") | not))'`.text();

        interface Asset {
            name: string;
            size: number;
            digest?: string;
            browserDownloadUrl: string;
        }

        const assets: Asset[] =
            JSON.parse("[" + assetsJson.trim().split("\n").join(",") + "]") || [];

        if (assets.length > 0) {
            console.log("Using GitHub API for metadata");

            for (const asset of assets) {
                const platform = extractPlatform(asset.name);

                if (platform && asset.digest && asset.digest.trim() !== "") {
                    metadata[platform] = {
                        filename: asset.name,
                        hash: asset.digest.replace(/^sha256:/, ""),
                        size: asset.size,
                    };
                    console.log(`Using GitHub API for ${platform} metadata`);
                } else if (platform) {
                    console.warn(
                        `${platform} digest is empty or missing, will use artifact fallback`
                    );
                }
            }
        }
    } catch (error) {
        console.warn("GitHub API metadata not available, using artifacts as fallback");
    }

    // Fallback to artifacts for any missing platforms
    const artifactFilesText = await $`ls artifacts/*.json 2>/dev/null || true`.quiet().text();
    const artifactFiles = artifactFilesText.trim().split("\n").filter(Boolean);

    for (const artifactPath of artifactFiles) {
        const filenameMatch = artifactPath.match(/artifacts\/(.+)-metadata\.json$/);

        if (filenameMatch) {
            const platform = filenameMatch[1];
            const artifactFile = Bun.file(artifactPath);

            if (!metadata[platform] && artifactFile.size > 0) {
                const data = await artifactFile.json();
                metadata[platform] = {
                    filename: data.filename,
                    hash: data.hash,
                    size: data.size,
                };
                console.log(`Loaded ${platform} metadata from artifact`);
            }
        }
    }

    if (Object.keys(metadata).length === 0) {
        console.error("No platform metadata available from API or artifacts");
        process.exit(1);
    }

    const platforms: Record<string, { url: string; hash: string; size: number }> = {};

    for (const [platform, platformMetadata] of Object.entries(metadata)) {
        if (platformMetadata) {
            platforms[platform] = {
                url: `https://github.com/${repoName}/releases/download/v${version}/${platformMetadata.filename}`,
                hash: platformMetadata.hash,
                size: platformMetadata.size,
            };
        }
    }

    const latestJson = {
        version,
        platforms,
    };

    // Create dist directory if it doesn't exist
    await $`mkdir -p dist`.quiet();

    // Write latest.json
    await Bun.write("dist/latest.json", JSON.stringify(latestJson, null, 2));

    console.log("Generated latest.json:");
    console.log(JSON.stringify(latestJson, null, 2));
}

// Main execution
(async () => {
    switch (command) {
        case "build":
            await buildAndUpload();
            break;
        case "json":
            await generateLatestJson();
            break;
        default:
            console.error(`Unknown command: ${command}`);
            process.exit(1);
    }
})();
