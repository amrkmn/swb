import { $ } from "bun";

type VersionType = "major" | "minor" | "patch";

interface Commit {
    hash: string;
    message: string;
    type?: string;
    scope?: string;
    subject?: string;
}

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

/**
 * Parse conventional commit message
 */
function parseCommit(message: string): { type?: string; scope?: string; subject?: string } {
    // Match: type(scope): subject or type: subject
    const match = message.match(/^(\w+)(?:\(([^)]+)\))?: (.+)$/);
    if (match) {
        return {
            type: match[1],
            scope: match[2],
            subject: match[3],
        };
    }
    return { subject: message };
}

/**
 * Get commits between two tags/refs
 */
async function getCommitsSince(since: string): Promise<Commit[]> {
    try {
        const result = await $`git log ${since}..HEAD --pretty=${"format:%H|%s"}`.text();
        const lines = result.trim().split("\n").filter(Boolean);

        return lines.map(line => {
            const [hash, message] = line.split("|");
            const parsed = parseCommit(message);
            return {
                hash: hash.substring(0, 7),
                message,
                ...parsed,
            };
        });
    } catch {
        return [];
    }
}

/**
 * Generate changelog from commits
 */
function generateChangelog(commits: Commit[], currentVersion: string, newVersion: string): string {
    const sections: Record<string, Commit[]> = {
        "✨ Features": [],
        "🐛 Bug Fixes": [],
        "📝 Documentation": [],
        "🔧 Chores": [],
        "♻️ Refactoring": [],
        "⚡ Performance": [],
        "🎨 Styling": [],
        "✅ Tests": [],
        "🔒 Security": [],
        "⬆️ Dependencies": [],
        Other: [],
    };

    for (const commit of commits) {
        const type = commit.type?.toLowerCase();

        if (type === "feat" || type === "feature") {
            sections["✨ Features"].push(commit);
        } else if (type === "fix") {
            sections["🐛 Bug Fixes"].push(commit);
        } else if (type === "docs") {
            sections["📝 Documentation"].push(commit);
        } else if (type === "chore") {
            sections["🔧 Chores"].push(commit);
        } else if (type === "refactor") {
            sections["♻️ Refactoring"].push(commit);
        } else if (type === "perf") {
            sections["⚡ Performance"].push(commit);
        } else if (type === "style") {
            sections["🎨 Styling"].push(commit);
        } else if (type === "test") {
            sections["✅ Tests"].push(commit);
        } else if (type === "security" || type === "sec") {
            sections["🔒 Security"].push(commit);
        } else if (type === "deps" || type === "dep") {
            sections["⬆️ Dependencies"].push(commit);
        } else {
            sections["Other"].push(commit);
        }
    }

    let changelog = `## [${newVersion}](https://github.com/amrkmn/swb/compare/v${currentVersion}...v${newVersion}) (${new Date().toISOString().split("T")[0]})\n\n`;

    for (const [section, sectionCommits] of Object.entries(sections)) {
        if (sectionCommits.length === 0) continue;

        changelog += `### ${section}\n\n`;

        for (const commit of sectionCommits) {
            const scope = commit.scope ? `**${commit.scope}:** ` : "";
            const subject = commit.subject || commit.message;
            changelog += `- ${scope}${subject} ([${commit.hash}](https://github.com/amrkmn/swb/commit/${commit.hash}))\n`;
        }

        changelog += "\n";
    }

    return changelog.trim();
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
        console.log("  1. Check code formatting");
        console.log(`  2. Update package.json version to ${newVersion}`);
        console.log("  3. Build the project");
        console.log("  4. Commit version bump");
        console.log(`  5. Create git tag v${newVersion}`);
        console.log("  6. Generate changelog from commits");
        console.log("  7. Push to remote (triggers CI release workflow)");
        process.exit(0);
    }

    // Step 1: Check code formatting
    console.log("🎨 Checking code formatting...");
    try {
        await $`bun run format:check`.quiet();
        console.log("✓ Code formatting is correct");
    } catch (err) {
        console.error("❌ Code formatting check failed!");
        console.error("   Please run 'bun run format' to fix formatting issues.");
        process.exit(1);
    }

    // Step 2: Update package.json version
    console.log(`📝 Updating version to ${newVersion}...`);
    packageJson.version = newVersion;
    await Bun.write(packageJsonFile, JSON.stringify(packageJson, null, 4) + "\n");

    // Step 3: Build the project with SWB_VERSION set
    console.log("🔨 Building...");
    await $`SWB_VERSION=${newVersion} bun run build`;

    // Step 4: Commit version bump
    console.log("📌 Committing version bump...");
    await $`git add package.json`;
    await $`git commit -m ${"chore(release): bump version to " + newVersion}`;

    // Step 5: Create git tag
    console.log(`🏷️  Creating tag v${newVersion}...`);
    await $`git tag ${"v" + newVersion}`;

    // Step 6: Generate changelog
    console.log("📝 Generating changelog...");
    const commits = await getCommitsSince(`v${currentVersion}`);
    const changelog = generateChangelog(commits, currentVersion, newVersion);

    console.log("");
    console.log("📋 Changelog Preview:");
    console.log("─".repeat(80));
    console.log(changelog);
    console.log("─".repeat(80));
    console.log("");

    // Save changelog to file
    const changelogFile = "RELEASE_NOTES.md";
    await Bun.write(changelogFile, changelog + "\n");
    console.log(`✓ Changelog saved to ${changelogFile}`);

    // Step 7: Push to remote (triggers CI release workflow)
    console.log("🚀 Pushing to remote...");
    await $`git push`;
    await $`git push --tags`;

    console.log("");
    console.log(`✅ Successfully pushed v${newVersion}!`);
    console.log("");
    console.log("📦 GitHub Actions will now build and publish the release.");
    console.log("   Watch progress at: https://github.com/amrkmn/swb/actions");
    console.log("");
    console.log(`📋 Changelog available at: ${changelogFile}`);
    console.log(
        `   Compare: https://github.com/amrkmn/swb/compare/v${currentVersion}...v${newVersion}`
    );
}

main().catch(err => {
    console.error("❌ Release failed:", err.message);
    process.exit(1);
});
