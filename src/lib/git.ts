/**
 * Git operations wrapper using Bun shell commands.
 * Provides functions for cloning, pulling, and inspecting git repositories.
 */

import { $ } from "bun";
import { existsSync } from "node:fs";
import path from "node:path";
import type { ProgressBar } from "src/utils/loader.ts";

export interface CloneOptions {
    progress?: ProgressBar;
    depth?: number;
}

export interface PullOptions {
    progress?: ProgressBar;
}

/**
 * Check if a directory is a git repository
 */
export async function isGitRepo(repoPath: string): Promise<boolean> {
    const gitDir = path.join(repoPath, ".git");
    return existsSync(gitDir);
}

/**
 * Get the remote URL for a git repository
 */
export async function getRemoteUrl(repoPath: string): Promise<string | null> {
    if (!(await isGitRepo(repoPath))) {
        return null;
    }

    try {
        const result = await $`git -C ${repoPath} remote get-url origin`.text();
        return result.trim();
    } catch {
        return null;
    }
}

/**
 * Get the last commit date for a repository
 */
export async function getLastCommitDate(repoPath: string): Promise<Date | null> {
    if (!(await isGitRepo(repoPath))) {
        return null;
    }

    try {
        const result = await $`git -C ${repoPath} log -1 --format=%cI`.text();
        const dateStr = result.trim();
        return dateStr ? new Date(dateStr) : null;
    } catch {
        return null;
    }
}

/**
 * Clone a git repository with optional progress reporting
 */
export async function clone(url: string, dest: string, options: CloneOptions = {}): Promise<void> {
    const args = ["git", "clone", "--progress"];

    if (options.depth) {
        args.push("--depth", options.depth.toString());
    }

    args.push(url, dest);

    if (options.progress) {
        // Spawn with stderr piped to parse progress
        const proc = Bun.spawn(args, {
            stderr: "pipe",
        });

        let totalObjects = 0;
        let receivedObjects = 0;

        // Parse git progress from stderr
        for await (const chunk of proc.stderr) {
            const text = new TextDecoder().decode(chunk);
            const lines = text.split("\r").filter(l => l.trim());

            for (const line of lines) {
                // Parse "Receiving objects: X% (Y/Z)"
                const receiveMatch = line.match(/Receiving objects:\s+\d+%\s+\((\d+)\/(\d+)\)/);
                if (receiveMatch) {
                    receivedObjects = parseInt(receiveMatch[1], 10);
                    totalObjects = parseInt(receiveMatch[2], 10);

                    if (totalObjects > 0) {
                        options.progress.setProgress(receivedObjects);
                    }
                }

                // Parse "Resolving deltas: X% (Y/Z)"
                const deltaMatch = line.match(/Resolving deltas:\s+\d+%\s+\((\d+)\/(\d+)\)/);
                if (deltaMatch) {
                    const resolvedDeltas = parseInt(deltaMatch[1], 10);
                    const totalDeltas = parseInt(deltaMatch[2], 10);

                    if (totalDeltas > 0) {
                        options.progress.setProgress(resolvedDeltas);
                    }
                }
            }
        }

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
            throw new Error(`Git clone failed with exit code ${exitCode}`);
        }
    } else {
        // Simple clone without progress
        await $`${args}`.quiet();
    }
}

/**
 * Pull updates for a git repository
 */
export async function pull(repoPath: string, options: PullOptions = {}): Promise<void> {
    if (!(await isGitRepo(repoPath))) {
        throw new Error(`Not a git repository: ${repoPath}`);
    }

    if (options.progress) {
        // Spawn with stderr piped to parse progress
        const proc = Bun.spawn(["git", "-C", repoPath, "pull", "--progress"], {
            stderr: "pipe",
        });

        // Parse git progress from stderr
        for await (const chunk of proc.stderr) {
            const text = new TextDecoder().decode(chunk);
            // Could parse pull progress here if needed
            // For now, just let it run
        }

        const exitCode = await proc.exited;
        if (exitCode !== 0) {
            throw new Error(`Git pull failed with exit code ${exitCode}`);
        }
    } else {
        // Simple pull without progress
        await $`git -C ${repoPath} pull --quiet`.quiet();
    }
}

export async function fetch(repoPath: string): Promise<void> {
    if (!(await isGitRepo(repoPath))) {
        throw new Error(`Not a git repository: ${repoPath}`);
    }

    await $`git -C ${repoPath} fetch --quiet`.quiet();
}

/**
 * Check if remote has updates
 */
export async function hasRemoteUpdates(repoPath: string): Promise<boolean> {
    if (!(await isGitRepo(repoPath))) {
        return false;
    }

    try {
        const branch = (await $`git -C ${repoPath} rev-parse --abbrev-ref HEAD`.text()).trim();
        const result = await $`git -C ${repoPath} rev-list HEAD..origin/${branch} --count`.text();
        const count = parseInt(result.trim(), 10);
        return count > 0;
    } catch {
        return false;
    }
}

/**
 * Get commit messages between HEAD and remote
 */
export async function getCommitsSinceRemote(repoPath: string): Promise<string[]> {
    if (!(await isGitRepo(repoPath))) {
        return [];
    }

    try {
        const branch = (await $`git -C ${repoPath} rev-parse --abbrev-ref HEAD`.text()).trim();
        const result =
            await $`git -C ${repoPath} log HEAD..origin/${branch} --pretty=format:%s`.text();
        return result
            .trim()
            .split("\n")
            .filter(line => line.trim());
    } catch {
        return [];
    }
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(repoPath: string = "."): Promise<string | null> {
    try {
        const result = await $`git -C ${repoPath} branch --show-current`.text();
        return result.trim() || null;
    } catch {
        return null;
    }
}

/**
 * Get the status of the working tree (porcelain format)
 */
export async function getStatus(repoPath: string = "."): Promise<string> {
    try {
        const result = await $`git -C ${repoPath} status --porcelain`.text();
        return result.trim();
    } catch {
        return "";
    }
}

/**
 * Get the latest tag
 */
export async function getLatestTag(repoPath: string = "."): Promise<string | null> {
    try {
        const result = await $`git -C ${repoPath} describe --tags --abbrev=0`.text();
        return result.trim() || null;
    } catch {
        return null;
    }
}

/**
 * Get the remote tracking branch for current branch
 */
export async function getRemoteTrackingBranch(repoPath: string = "."): Promise<string | null> {
    try {
        const result = await $`git -C ${repoPath} rev-parse --abbrev-ref HEAD@{u}`.text();
        return result.trim() || null;
    } catch {
        return null;
    }
}

/**
 * Get the commit hash for a ref
 */
export async function getCommitHash(ref: string, repoPath: string = "."): Promise<string | null> {
    try {
        const result = await $`git -C ${repoPath} rev-parse ${ref}`.text();
        return result.trim() || null;
    } catch {
        return null;
    }
}

/**
 * Stage all changes
 */
export async function addAll(repoPath: string = "."): Promise<void> {
    await $`git -C ${repoPath} add .`.quiet();
}

/**
 * Create a commit with a message
 */
export async function commit(message: string, repoPath: string = "."): Promise<void> {
    await $`git -C ${repoPath} commit -m ${message}`.quiet();
}

/**
 * Create an annotated tag
 */
export async function createTag(
    tag: string,
    message: string,
    repoPath: string = "."
): Promise<void> {
    await $`git -C ${repoPath} tag -a ${tag} -m ${message}`.quiet();
}

/**
 * Push to a remote branch
 */
export async function push(remote: string, branch: string, repoPath: string = "."): Promise<void> {
    await $`git -C ${repoPath} push ${remote} ${branch}`.quiet();
}

/**
 * Get commits since a specific ref with custom format
 */
export async function getCommitsSince(
    since: string,
    format: string = "format:%H|%s",
    repoPath: string = "."
): Promise<string> {
    try {
        const result = await $`git -C ${repoPath} log ${since}..HEAD --pretty=${format}`.text();
        return result.trim();
    } catch {
        return "";
    }
}

/**
 * Count commits between two refs
 */
export async function getCommitCount(from: string, to: string, repoPath: string): Promise<number> {
    try {
        const result = await $`git -C ${repoPath} rev-list --count ${from}..${to}`.text();
        return parseInt(result.trim(), 10) || 0;
    } catch {
        return 0;
    }
}
