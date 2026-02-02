import * as git from "../src/utils/git.ts";

interface Commit {
    hash: string;
    message: string;
    type?: string;
    scope?: string;
    subject?: string;
}

function parseCommit(message: string): { type?: string; scope?: string; subject?: string } {
    const match = message.match(/^(\w+)(?:\(([^)]+)\))?: (.+)$/);
    return match ? { type: match[1], scope: match[2], subject: match[3] } : { subject: message };
}

export async function getCommitsSince(since: string): Promise<Commit[]> {
    try {
        const result = await git.getCommitsSince(since, "format:%H|%s");
        return result
            .trim()
            .split("\n")
            .filter(Boolean)
            .map(line => {
                const [hash, message] = line.split("|");
                return { hash: hash.substring(0, 7), message, ...parseCommit(message) };
            });
    } catch {
        return [];
    }
}

const TYPE_MAPPING: Record<string, string> = {
    feat: "Features",
    feature: "Features",
    fix: "Bug Fixes",
    docs: "Documentation",
    chore: "Chores",
    refactor: "Refactoring",
    perf: "Performance",
    style: "Styling",
    test: "Tests",
    security: "Security",
    sec: "Security",
    deps: "Dependencies",
    dep: "Dependencies",
};

export function generateChangelog(
    commits: Commit[],
    currentVersion: string,
    newVersion: string
): string {
    const sections: Record<string, Commit[]> = {
        Features: [],
        "Bug Fixes": [],
        Documentation: [],
        Chores: [],
        Refactoring: [],
        Performance: [],
        Styling: [],
        Tests: [],
        Security: [],
        Dependencies: [],
        Other: [],
    };

    for (const commit of commits) {
        const sectionName = commit.type ? TYPE_MAPPING[commit.type] || "Other" : "Other";
        sections[sectionName].push(commit);
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
    const [from, to] = process.argv.slice(2);

    if (!from || !to) {
        console.log("Usage: bun run scripts/changelog.ts <from-version> <to-version>");
        process.exit(1);
    }

    const fromVersion = from.startsWith("v") ? from : `v${from}`;
    const toVersion = to.startsWith("v") ? to.substring(1) : to;
    const fromVersionDisplay = fromVersion.substring(1);

    console.log(`Generating changelog from ${fromVersion} to v${toVersion}...\n`);

    const commits = await getCommitsSince(fromVersion);

    if (commits.length === 0) {
        console.log("No commits found between these versions");
        process.exit(0);
    }

    console.log(`Found ${commits.length} commit(s)\n`);

    const changelog = generateChangelog(commits, fromVersionDisplay, toVersion);

    console.log("─".repeat(80));
    console.log(changelog);
    console.log("─".repeat(80));
}

if (import.meta.main) {
    main().catch(err => {
        console.error("Failed to generate changelog:", err.message);
        process.exit(1);
    });
}
