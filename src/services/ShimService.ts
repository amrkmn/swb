import { $ } from "bun";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { Service } from "src/core/Context";
import { bothScopes } from "src/utils/paths";

export class ShimService extends Service {
    /**
     * Find executable location (Shims -> PATH -> where.exe)
     */
    async findExecutable(name: string): Promise<string[]> {
        // 1. Shims
        let matches = this.findInShims(name);

        // 2. PATH
        if (matches.length === 0) {
            matches = this.findInPATH(name);
        } else {
            // Add PATH matches if not already found
            const pathMatches = this.findInPATH(name);
            for (const p of pathMatches) {
                if (!matches.some(m => m.toLowerCase() === p.toLowerCase())) {
                    matches.push(p);
                }
            }
        }

        // 3. Fallback to where.exe
        if (matches.length === 0) {
            try {
                // Use where.exe to find the command
                const output = await $`where.exe ${name}`.quiet().text();
                if (output) {
                    const lines = output
                        .split(/\r?\n/)
                        .map(s => s.trim())
                        .filter(Boolean);
                    for (const p of lines) {
                        if (!matches.some(m => m.toLowerCase() === p.toLowerCase())) {
                            matches.push(p);
                        }
                    }
                }
            } catch {
                // ignore
            }
        }

        return matches;
    }

    private getPathExts(): string[] {
        try {
            const env = process.env || {};
            const val = env.PATHEXT || ".COM;.EXE;.BAT;.CMD;.VBS;.VBE;.JS;.JSE;.WSF;.WSH;.MSC;.PS1";
            return val
                .split(";")
                .map(s => s.trim().toLowerCase())
                .filter(Boolean);
        } catch {
            return [".exe", ".bat", ".cmd", ".com", ".ps1"];
        }
    }

    private candidatesForName(name: string): string[] {
        const exts = this.getPathExts();
        if (path.extname(name) !== "") return [name];

        const lower = name.toLowerCase();
        const uniq: Set<string> = new Set();
        const out: string[] = [];

        for (const e of exts) {
            const c = lower + e;
            if (!uniq.has(c)) {
                uniq.add(c);
                out.push(c);
            }
        }
        if (!uniq.has(lower)) {
            out.push(lower);
        }
        return out;
    }

    private fileExistsCaseInsensitive(dir: string, fileLower: string): string | null {
        const direct = path.join(dir, fileLower);
        if (existsSync(direct)) return direct;

        try {
            const ents = readdirSync(dir, { withFileTypes: true });
            for (const ent of ents) {
                if (ent.name.toLowerCase() === fileLower.toLowerCase()) {
                    const p = path.join(dir, ent.name);
                    try {
                        if (statSync(p).isFile()) return p;
                    } catch {}
                }
            }
        } catch {}
        return null;
    }

    private findInShims(name: string): string[] {
        const cands = this.candidatesForName(name);
        const matches: string[] = [];
        const seen = new Set<string>();

        for (const sp of bothScopes()) {
            const shims = sp.shims;
            for (const c of cands) {
                const shimPath = this.fileExistsCaseInsensitive(shims, c);
                if (shimPath) {
                    const target = this.resolveShimTarget(shimPath);
                    const result = target || shimPath;
                    if (!seen.has(result.toLowerCase())) {
                        seen.add(result.toLowerCase());
                        matches.push(result);
                    }
                }
            }
        }
        return matches;
    }

    private resolveShimTarget(shimPath: string): string | null {
        try {
            const shimDir = path.dirname(shimPath);
            const shimName = path.basename(shimPath, path.extname(shimPath));
            const scoopPath = path.dirname(shimDir);
            const appsDir = path.join(scoopPath, "apps");

            if (!existsSync(appsDir)) return null;

            try {
                const apps = readdirSync(appsDir, { withFileTypes: true })
                    .filter(d => d.isDirectory())
                    .map(d => d.name);

                for (const app of apps) {
                    const currentDir = path.join(appsDir, app, "current");
                    if (!existsSync(currentDir)) continue;

                    const cands = this.candidatesForName(shimName);
                    for (const candidate of cands) {
                        const target = this.fileExistsCaseInsensitive(currentDir, candidate);
                        if (target) return target;
                    }

                    // Check subdirs
                    try {
                        const subDirs = readdirSync(currentDir, { withFileTypes: true })
                            .filter(d => d.isDirectory())
                            .map(d => d.name);

                        for (const sub of subDirs) {
                            const subPath = path.join(currentDir, sub);
                            for (const candidate of cands) {
                                const target = this.fileExistsCaseInsensitive(subPath, candidate);
                                if (target) return target;
                            }
                        }
                    } catch {}
                }
            } catch {}
        } catch {}
        return null;
    }

    private findInPATH(name: string): string[] {
        const matches: string[] = [];
        const seen = new Set<string>();

        // Use Bun.which() to find the first match in PATH
        const firstMatch = Bun.which(name);
        if (firstMatch) {
            seen.add(firstMatch.toLowerCase());
            matches.push(firstMatch);
        }

        // Continue searching PATH for additional matches
        const cands = this.candidatesForName(name);
        let PATH = process.env.Path || process.env.PATH || "";
        const dirs = PATH.split(path.delimiter)
            .map(d => d.trim())
            .filter(Boolean);

        for (const dir of dirs) {
            for (const c of cands) {
                const p = this.fileExistsCaseInsensitive(dir, c);
                if (p && !seen.has(p.toLowerCase())) {
                    seen.add(p.toLowerCase());
                    matches.push(p);
                }
            }
        }
        return matches;
    }
}
