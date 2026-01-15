import { $ } from "bun";
import { getCommitsSince, generateChangelog } from "./changelog.ts";

const DRY_RUN = process.argv.includes("--dry-run");

async function getCurrentVersion(): Promise<string> {
    try {
        return (await $`git describe --tags --abbrev=0`.text()).trim();
    } catch {
        return "v0.0.0";
    }
}

function bumpVersion(version: string, type: "major" | "minor" | "patch"): string {
    const [major, minor, patch] = version.replace("v", "").split(".").map(Number);

    if (type === "major") return `v${major + 1}.0.0`;
    if (type === "minor") return `v${major}.${minor + 1}.0`;
    return `v${major}.${minor}.${patch + 1}`;
}

async function main() {
    const bumpType = process.argv[2]?.replace("--", "") as "major" | "minor" | "patch" | undefined;
    if (!bumpType || !["major", "minor", "patch"].includes(bumpType)) {
        throw new Error("Usage: bun run release <major|minor|patch> [--dry-run]");
    }

    const currentVersion = await getCurrentVersion();
    const newVersion = bumpVersion(currentVersion, bumpType);

    console.log(`Releasing swb`);
    console.log(`   ${currentVersion} -> ${newVersion}`);
    console.log("");

    if (DRY_RUN) {
        console.log("Dry run mode - no changes will be made");
        console.log("");
        console.log("Would perform:");
        console.log("  1. Check git status and branch");
        console.log("  2. Check code formatting");
        console.log("  3. Run tests");
        console.log("  4. Build executable");
        console.log("  5. Generate changelog from commits");
        console.log(`  6. Create GitHub release ${newVersion}`);
        console.log(`  7. Commit: release: ${newVersion}`);
        console.log(`  8. Create tag ${newVersion}`);
        console.log("  9. Push to origin/main and tags");
        return;
    }

    // Verify git status
    console.log("Checking git status...");
    const status = (await $`git status --porcelain`.text()).trim();
    if (status) throw new Error("Uncommitted changes found. Commit or stash them first.");

    const branch = (await $`git branch --show-current`.text()).trim();
    if (branch !== "main") throw new Error("Must be on main branch to release.");

    const remoteMain = (await $`git rev-parse --abbrev-ref HEAD@{u}`.text()).trim();
    const localCommit = (await $`git rev-parse HEAD`.text()).trim();
    const remoteCommit = (await $`git rev-parse ${remoteMain}`.text()).trim();
    if (localCommit !== remoteCommit) throw new Error("Branch out of sync with remote.");
    console.log("Git checks passed");
    console.log("");

    // Check code formatting
    console.log("Checking code formatting...");
    try {
        await $`bun run format:check`.quiet();
    } catch {
        console.log("   Code not formatted. Running formatter...");
        await $`bun run format`.quiet();
        console.log("   Code formatted successfully");
    }
    console.log("");

    // Run tests and build
    console.log("Running tests...");
    await $`bun test`;
    console.log("");

    console.log("Building executable...");
    await $`bun run build`;
    console.log("");

    // Generate changelog
    console.log("Generating changelog...");
    const commits = await getCommitsSince(currentVersion);
    const changelog = generateChangelog(
        commits,
        currentVersion.replace("v", ""),
        newVersion.replace("v", "")
    );
    console.log(`Found ${commits.length} commit(s)`);
    console.log("");

    // Create GitHub release
    console.log(`Creating GitHub release ${newVersion}...`);
    await $`gh release create ${newVersion} --title ${newVersion} --notes ${changelog}`;
    console.log("");

    // Commit, tag, and push
    console.log(`Committing: release: ${newVersion}`);
    await $`git add .`;
    await $`git commit -m "release: ${newVersion}"`;

    console.log(`Creating tag ${newVersion}...`);
    await $`git tag -a ${newVersion} -m ${newVersion}`;

    console.log(`Pushing to origin/main and ${newVersion}...`);
    await $`git push origin main`;
    await $`git push origin ${newVersion}`;
    console.log("");

    console.log(`Successfully released ${newVersion}!`);
    console.log("");
    console.log("Release notes available at:");
    console.log(`  https://github.com/amrkmn/swb/releases/tag/${newVersion}`);
    console.log(
        `  Compare: https://github.com/amrkmn/swb/compare/${currentVersion}...${newVersion}`
    );
}

main().catch(err => {
    console.error(`Release failed: ${err.message}`);
    process.exit(1);
});
