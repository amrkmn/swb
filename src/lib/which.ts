/**
 * Executable discovery for Windows.
 * - Prefer Scoop shims (user, then global)
 * - Then search system PATH
 * - Handle Windows executable extensions (PATHEXT) and case-insensitive FS
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { bothScopes } from "src/lib/paths.ts";

function getPathExts(): string[] {
    try {
        const env = typeof process !== "undefined" && process.env ? process.env : {};
        const val = env.PATHEXT || ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.PS1";
        return val
            .split(";")
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);
    } catch {
        return [".exe", ".bat", ".cmd", ".com", ".ps1"];
    }
}

function hasExtension(name: string): boolean {
    return path.extname(name) !== "";
}

function candidatesForName(name: string): string[] {
    const exts = getPathExts();
    if (hasExtension(name)) return [name];
    const lower = name.toLowerCase();
    const uniq: Record<string, true> = {};
    const out: string[] = [];
    for (const e of exts) {
        const c = lower + e;
        if (!uniq[c]) {
            uniq[c] = true;
            out.push(c);
        }
    }
    // Also consider without extension (some scripts may be extensionless)
    if (!uniq[lower]) {
        uniq[lower] = true;
        out.push(lower);
    }
    return out;
}

function fileExistsCaseInsensitive(dir: string, fileLower: string): string | null {
    // Fast path: check exact
    const direct = path.join(dir, fileLower);
    if (existsSync(direct)) return direct;

    // Slow path: scan directory to find a case-insensitive match
    try {
        const ents = readdirSync(dir, { withFileTypes: true });
        for (const ent of ents) {
            const n = ent.name;
            if (n.toLowerCase() === fileLower.toLowerCase()) {
                const p = path.join(dir, n);
                try {
                    const st = statSync(p);
                    if (st.isFile()) return p;
                } catch {
                    // ignore
                }
            }
        }
    } catch {
        // ignore
    }
    return null;
}

/**
 * Read a Scoop shim file and resolve it to the actual executable target.
 * Scoop shims are typically .exe files that redirect to the actual executable.
 */
function resolveShimTarget(shimPath: string): string | null {
    try {
        // For Scoop, the actual executable is usually located at:
        // ~\scoop\apps\<app>\current\<executable>
        // We can derive this from the shim path structure

        const shimDir = path.dirname(shimPath);
        const shimName = path.basename(shimPath, path.extname(shimPath));

        // Check if this is a Scoop shims directory
        const scoopPath = path.dirname(shimDir);
        const appsDir = path.join(scoopPath, "apps");

        if (!existsSync(appsDir)) return null;

        // Look through installed apps for a binary matching the shim name
        try {
            const apps = readdirSync(appsDir, { withFileTypes: true })
                .filter(d => d.isDirectory())
                .map(d => d.name);

            for (const app of apps) {
                const currentDir = path.join(appsDir, app, "current");
                if (!existsSync(currentDir)) continue;

                // Look for the executable in the current directory
                const candidates = candidatesForName(shimName);
                for (const candidate of candidates) {
                    const target = fileExistsCaseInsensitive(currentDir, candidate);
                    if (target) return target;
                }

                // Also check subdirectories (like bin/)
                try {
                    const subDirs = readdirSync(currentDir, { withFileTypes: true })
                        .filter(d => d.isDirectory())
                        .map(d => d.name);

                    for (const subDir of subDirs) {
                        const subDirPath = path.join(currentDir, subDir);
                        for (const candidate of candidates) {
                            const target = fileExistsCaseInsensitive(subDirPath, candidate);
                            if (target) return target;
                        }
                    }
                } catch {
                    // ignore subdirectory scan errors
                }
            }
        } catch {
            // ignore apps directory scan errors
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Search Scoop shims directories for a command name.
 * Returns matches in order: user shims first, then global shims.
 */
export function findInShims(name: string): string[] {
    const cands = candidatesForName(name);
    const matches: string[] = [];

    for (const sp of bothScopes()) {
        const shims = sp.shims;
        for (const c of cands) {
            const shimPath = fileExistsCaseInsensitive(shims, c);
            if (shimPath) {
                // Try to resolve shim to actual executable
                const target = resolveShimTarget(shimPath);
                if (target) {
                    matches.push(target);
                } else {
                    // Fallback to shim path if we can't resolve it
                    matches.push(shimPath);
                }
            }
        }
    }

    return uniquePaths(matches);
}

/**
 * Search the system PATH for a command name.
 */
export function findInPATH(name: string): string[] {
    const cands = candidatesForName(name);
    const matches: string[] = [];

    let PATH = "";
    try {
        PATH =
            (typeof process !== "undefined" &&
                process.env &&
                (process.env.Path || process.env.PATH)) ||
            "";
    } catch {
        PATH = "";
    }
    if (!PATH) return [];

    const sep = ";";
    const dirs = PATH.split(sep)
        .map(d => d.trim())
        .filter(Boolean);

    for (const dir of dirs) {
        for (const c of cands) {
            const p = fileExistsCaseInsensitive(dir, c);
            if (p) matches.push(p);
        }
    }

    return uniquePaths(matches);
}

function uniquePaths(arr: string[]): string[] {
    const seen: Record<string, true> = {};
    const out: string[] = [];
    for (const p of arr) {
        const k = p.toLowerCase();
        if (!seen[k]) {
            seen[k] = true;
            out.push(p);
        }
    }
    return out;
}
