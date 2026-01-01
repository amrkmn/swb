import { $ } from "bun";

type VersionType = "major" | "minor" | "patch";

function parseVersion(version: string): [number, number, number] {
    const [major, minor, patch] = version.split(".").map(Number);
    return [major, minor, patch];
}

function bumpVersion(current: string, type: VersionType): string {
    const [major, minor, patch] = parseVersion(current);

    switch (type) {
        case "major":
            return `${major + 1}.0.0`;
        case "minor":
            return `${major}.${minor + 1}.0`;
        case "patch":
            return `${major}.${minor}.${patch + 1}`;
    }
}

async function main() {
    const args = process.argv.slice(2);
    const versionType = args[0] as VersionType | undefined;
    const dryRun = args.includes("--dry-run");

    if (!versionType || !["major", "minor", "patch"].includes(versionType)) {
        console.log("Usage: bun run scripts/release.ts <major|minor|patch> [--dry-run]");
        console.log("");
        console.log("Options:");
        console.log("  major     Bump major version (x.0.0)");
        console.log("  minor     Bump minor version (0.x.0)");
        console.log("  patch     Bump patch version (0.0.x)");
        console.log("  --dry-run Show what would happen without making changes");
        process.exit(1);
    }

    // Read current package.json
    const packageJsonFile = Bun.file("package.json");
    const packageJson = await packageJsonFile.json();
    const currentVersion = packageJson.version;
    const newVersion = bumpVersion(currentVersion, versionType);

    console.log(`📦 Releasing ${packageJson.name}`);
    console.log(`   ${currentVersion} → ${newVersion}`);
    console.log("");

    if (dryRun) {
        console.log("🔍 Dry run mode - no changes will be made");
        console.log("");
        console.log("Would perform:");
        console.log(`  1. Update package.json version to ${newVersion}`);
        console.log("  2. Build the project");
        console.log("  3. Commit version bump");
        console.log(`  4. Create git tag v${newVersion}`);
        console.log("  5. Push to remote");
        console.log("  6. Create release archive (zip)");
        console.log("  7. Create GitHub release");
        process.exit(0);
    }

    // Step 1: Update package.json version
    console.log(`📝 Updating version to ${newVersion}...`);
    packageJson.version = newVersion;
    await Bun.write(packageJsonFile, JSON.stringify(packageJson, null, 4) + "\n");

    // Step 2: Build the project with SWB_VERSION set
    console.log("🔨 Building...");
    await $`SWB_VERSION=${newVersion} bun run build`;

    // Step 3: Commit version bump
    console.log("📌 Committing version bump...");
    await $`git add package.json`;
    await $`git commit -m ${"chore(release): bump version to " + newVersion}`;

    // Step 4: Create git tag
    console.log(`🏷️  Creating tag v${newVersion}...`);
    await $`git tag ${"v" + newVersion}`;

    // Step 5: Push to remote
    console.log("🚀 Pushing to remote...");
    await $`git push`;
    await $`git push --tags`;

    // Step 6: Create release zip
    console.log("📦 Creating release archive...");
    const releaseZip = `swb-v${newVersion}-windows-x64.zip`;
    await $`powershell Compress-Archive -Path ./dist/swb.exe,./README.md,./LICENSE -DestinationPath ./dist/${releaseZip} -Force`;

    // Step 7: Create GitHub release
    console.log("🚀 Creating GitHub release...");
    await $`gh release create ${"v" + newVersion} ./dist/${releaseZip} --title ${"v" + newVersion} --generate-notes`;

    console.log("");
    console.log(`✅ Successfully released v${newVersion}!`);
}

main().catch(err => {
    console.error("❌ Release failed:", err.message);
    process.exit(1);
});
