import { $ } from "bun";

interface Commit {
    hash: string;
    message: string;
    type?: string;
    scope?: string;
    subject?: string;
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

    if (args.length < 2) {
        console.log("Usage: bun run scripts/changelog.ts <from-version> <to-version>");
        console.log("");
        console.log("Examples:");
        console.log("  bun run scripts/changelog.ts v0.4.10 0.4.11");
        console.log("  bun run scripts/changelog.ts 0.4.10 0.4.11");
        process.exit(1);
    }

    let fromVersion = args[0];
    let toVersion = args[1];

    // Add 'v' prefix if missing
    if (!fromVersion.startsWith("v")) {
        fromVersion = `v${fromVersion}`;
    }

    // Remove 'v' prefix from version number for display
    const displayVersion = toVersion.startsWith("v") ? toVersion.substring(1) : toVersion;
    const displayFromVersion = fromVersion.substring(1);

    console.log(`📋 Generating changelog from ${fromVersion} to v${displayVersion}...`);
    console.log("");

    const commits = await getCommitsSince(fromVersion);

    if (commits.length === 0) {
        console.log("⚠️  No commits found between these versions");
        process.exit(0);
    }

    console.log(`Found ${commits.length} commit(s)`);

    const changelog = generateChangelog(commits, displayFromVersion, displayVersion);

    // Display changelog
    console.log("");
    console.log("─".repeat(80));
    console.log(changelog);
    console.log("─".repeat(80));
    console.log("");

    // Read existing CHANGELOG.md if it exists
    const changelogFile = "CHANGELOG.md";
    let existingContent = "";

    try {
        const file = Bun.file(changelogFile);
        existingContent = await file.text();
    } catch {
        // File doesn't exist, create header
        existingContent =
            "# Changelog\n\nAll notable changes to this project will be documented in this file.\n";
    }

    // Prepend new changelog entry
    let newContent: string;
    if (existingContent.includes("# Changelog")) {
        // Insert after the header
        const lines = existingContent.split("\n");
        const headerEndIndex = lines.findIndex(line => line.startsWith("## ["));
        if (headerEndIndex !== -1) {
            // Insert before first version entry with delimiter above it
            lines.splice(headerEndIndex, 0, "", changelog, "", "---");
            newContent = lines.join("\n");
        } else {
            // No existing entries, append to end
            newContent = existingContent + "\n" + changelog + "\n";
        }
    } else {
        // No header, create new file
        newContent =
            "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n" +
            changelog +
            "\n";
    }

    await Bun.write(changelogFile, newContent);
    console.log(`✓ Changelog saved to ${changelogFile}`);
}

main().catch(err => {
    console.error("❌ Failed to generate changelog:", err.message);
    process.exit(1);
});
