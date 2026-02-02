import { $ } from "bun";
import { generateChangelog, getCommitsSince } from "./changelog.ts";
import * as git from "../src/utils/git.ts";

const DRY_RUN = process.argv.includes("--dry-run");

async function getCurrentVersion(): Promise<string> {
    const tag = await git.getLatestTag();
    return tag || "v0.0.0";
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

    // Verify git status (only check SWB source files, not scripts)
    console.log("Checking git status...");
    const status = await git.getStatus();
    if (status) {
        // Filter out changes in scripts/ folder
        const lines = status.split("\n").filter(line => {
            const file = line.slice(2).trim(); // Remove status prefix (e.g., "M ")
            return !file.startsWith("scripts/");
        });
        if (lines.length > 0) {
            throw new Error(
                "Uncommitted changes found in source files. Commit or stash them first."
            );
        }
    }

    const branch = await git.getCurrentBranch();
    if (branch !== "main") throw new Error("Must be on main branch to release.");

    const remoteMain = await git.getRemoteTrackingBranch();
    if (!remoteMain) throw new Error("No remote tracking branch found.");
    const localCommit = await git.getCommitHash("HEAD");
    const remoteCommit = await git.getCommitHash(remoteMain);
    if (localCommit !== remoteCommit) throw new Error("Branch out of sync with remote.");

    // Check if tag already exists (locally or remotely)
    if (await git.tagExists(newVersion)) {
        throw new Error(
            `Tag ${newVersion} already exists locally. Delete it first: git tag -d ${newVersion}`
        );
    }

    if (await git.remoteTagExists(newVersion)) {
        throw new Error(
            `Tag ${newVersion} already exists on remote. Delete it first: git push origin :refs/tags/${newVersion}`
        );
    }

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

    // Update package.json version
    console.log("Updating package.json version...");
    const packageJson = await Bun.file("package.json").json();
    packageJson.version = newVersion.replace("v", "");
    await Bun.write("package.json", JSON.stringify(packageJson, null, 4) + "\n");
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

    // Commit changes first
    console.log(`Committing: release: ${newVersion}`);
    await git.addAll();
    await git.commit(`release: ${newVersion}`);

    console.log(`Creating tag ${newVersion}...`);
    await git.createTag(newVersion, newVersion);

    // Push to remote (with rollback on failure)
    try {
        console.log(`Pushing to origin/main...`);
        await git.push("origin", "main");

        console.log(`Pushing tag ${newVersion}...`);
        await git.push("origin", newVersion);
    } catch (err) {
        console.error("\nPush failed! Rolling back...");

        // Delete local tag
        await git.deleteTag(newVersion);

        // Reset commit
        await git.resetHard("HEAD~1");

        console.error("Rollback complete. Repository restored to previous state.");
        throw err;
    }

    // Create GitHub release after successful push
    console.log(`Creating GitHub release ${newVersion}...`);
    try {
        await $`gh release create ${newVersion} --title ${newVersion} --notes ${changelog}`;
    } catch (err) {
        console.warn("\nGitHub release creation failed, but code was pushed successfully.");
        console.warn("You can create the release manually at:");
        console.warn(`  https://github.com/amrkmn/swb/releases/new?tag=${newVersion}`);
    }
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
