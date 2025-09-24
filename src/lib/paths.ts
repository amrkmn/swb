/**
 * Windows-specific Scoop path resolution helpers.
 * Targets:
 *  - User root: %USERPROFILE%\scoop
 *  - Global root: C:\ProgramData\scoop
 */

import path from "node:path";
import { existsSync } from "node:fs";

export type InstallScope = "user" | "global";

export interface ScoopPaths {
  scope: InstallScope;
  root: string;     // e.g., C:\Users\Me\scoop or C:\ProgramData\scoop
  apps: string;     // <root>\apps
  shims: string;    // <root>\shims
  buckets: string;  // <root>\buckets
  cache: string;    // <root>\cache
}

export function getUserProfile(): string {
  const p = (typeof process !== "undefined" && process.env)
    ? (process.env.USERPROFILE || process.env.HOME)
    : undefined;
  if (!p) throw new Error("Could not determine USERPROFILE/HOME");
  return p;
}

export function getUserScoopRoot(): string {
  const home = getUserProfile();
  return path.join(home, "scoop");
}

export function getGlobalScoopRoot(): string {
  // Default Scoop global root
  return "C:\\\\ProgramData\\\\scoop";
}

export function resolveScoopPaths(scope: InstallScope): ScoopPaths {
  const root = scope === "global" ? getGlobalScoopRoot() : getUserScoopRoot();
  return {
    scope,
    root,
    apps: path.join(root, "apps"),
    shims: path.join(root, "shims"),
    buckets: path.join(root, "buckets"),
    cache: path.join(root, "cache"),
  };
}

export function scopeExists(scope: InstallScope): boolean {
  const root = scope === "global" ? getGlobalScoopRoot() : getUserScoopRoot();
  return existsSync(root);
}

export function bothScopes(): ScoopPaths[] {
  const u = resolveScoopPaths("user");
  const g = resolveScoopPaths("global");
  return [u, g];
}