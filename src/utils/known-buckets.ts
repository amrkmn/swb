/**
 * Known Scoop buckets registry.
 * This list is maintained by the Scoop project and includes officially recognized buckets.
 * Source: https://github.com/ScoopInstaller/Scoop/blob/master/buckets.json
 */

export interface KnownBucket {
    name: string;
    source: string;
}

/**
 * Official known buckets from Scoop
 */
export const KNOWN_BUCKETS: Record<string, string> = {
    main: "https://github.com/ScoopInstaller/Main",
    extras: "https://github.com/ScoopInstaller/Extras",
    versions: "https://github.com/ScoopInstaller/Versions",
    nirsoft: "https://github.com/ScoopInstaller/Nirsoft",
    sysinternals: "https://github.com/niheaven/scoop-sysinternals",
    php: "https://github.com/ScoopInstaller/PHP",
    "nerd-fonts": "https://github.com/matthewjberger/scoop-nerd-fonts",
    nonportable: "https://github.com/ScoopInstaller/Nonportable",
    java: "https://github.com/ScoopInstaller/Java",
    games: "https://github.com/Calinou/scoop-games",
};

/**
 * Get known bucket URL by name
 */
export function getKnownBucket(name: string): string | null {
    return KNOWN_BUCKETS[name] || null;
}

/**
 * Get all known buckets as array
 */
export function getAllKnownBuckets(): KnownBucket[] {
    return Object.entries(KNOWN_BUCKETS).map(([name, source]) => ({
        name,
        source,
    }));
}

/**
 * Check if a bucket is in the known list
 */
export function isKnownBucket(name: string): boolean {
    return name in KNOWN_BUCKETS;
}
