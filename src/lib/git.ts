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
 * Check if remote has updates
 */
export async function hasRemoteUpdates(repoPath: string): Promise<boolean> {
    if (!(await isGitRepo(repoPath))) {
        return false;
    }

    try {
        // Fetch remote refs without updating working tree
        await $`git -C ${repoPath} fetch origin --quiet`.quiet();

        // Check if local is behind remote
        const result = await $`git -C ${repoPath} rev-list HEAD...origin/HEAD --count`.text();
        const count = parseInt(result.trim(), 10);
        return count > 0;
    } catch {
        return false;
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

/**
 * Get commit messages between HEAD and remote
 */
export async function getCommitsSinceRemote(repoPath: string): Promise<string[]> {
    if (!(await isGitRepo(repoPath))) {
        return [];
    }

    try {
        const result = await $`git -C ${repoPath} log HEAD..origin/HEAD --pretty=format:%s`.text();
        return result
            .trim()
            .split("\n")
            .filter(line => line.trim());
    } catch {
        return [];
    }
}
