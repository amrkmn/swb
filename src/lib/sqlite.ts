import { Database } from "bun:sqlite";
import { existsSync } from "fs";
import { join } from "path";
import { SearchResult } from "./commands/search.js";
import { debug, error } from "src/utils/logger.ts";

/**
 * Represents a row from Scoop's SQLite app table
 */
interface ScoopAppRecord {
    name: string;
    description: string;
    version: string;
    bucket: string;
    manifest: string; // JSON string
    binary: string; // pipe-separated string
    shortcut: string; // pipe-separated string
    dependency: string; // pipe-separated string
    suggest: string; // pipe-separated string
}

/**
 * Cache manager that uses Scoop's built-in SQLite cache system
 * Falls back to manual bucket scanning if SQLite cache is unavailable
 */
export class ScoopSQLiteCache {
    private db: Database | null = null;
    private scoopDbPath: string | null = null;
    private initialized = false;

    /**
     * Initialize the SQLite cache connection - required for SWB operation
     * @returns true if initialization was successful, false otherwise
     */
    async initialize(): Promise<boolean> {
        if (this.initialized) {
            return this.db !== null;
        }

        try {
            // Find Scoop installation and database
            const scoopRoot = this.findScoopRoot();
            if (!scoopRoot) {
                error("Scoop installation not found.");
                error("Please install Scoop first: https://scoop.sh");
                process.exit(1);
            }

            // Check if use_sqlite_cache is enabled
            if (!(await this.isSQLiteCacheEnabled(scoopRoot))) {
                error("SQLite cache is not enabled.");
                error("Enable it with: scoop config use_sqlite_cache true");
                error("Then run: scoop update");
                process.exit(1);
            }

            // Check if scoop.db exists
            this.scoopDbPath = join(scoopRoot, "scoop.db");
            if (!existsSync(this.scoopDbPath)) {
                error("Scoop database not found.");
                error("Run 'scoop update' to build the cache.");
                process.exit(1);
            }

            // Open database connection
            this.db = new Database(this.scoopDbPath, { readonly: true });

            // Verify the app table exists and has data
            const tableCheck = this.db
                .query(
                    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='app'"
                )
                .get() as { count: number };
            if (tableCheck.count === 0) {
                error("Scoop database app table not found.");
                error("Run 'scoop update' to rebuild the cache.");
                process.exit(1);
            }

            // Check if there's any data in the app table
            const dataCheck = this.db.query("SELECT COUNT(*) as count FROM app LIMIT 1").get() as {
                count: number;
            };
            if (dataCheck.count === 0) {
                error("Scoop database app table is empty.");
                error("Run 'scoop update' to populate the cache.");
                process.exit(1);
            }

            debug("Successfully initialized Scoop SQLite cache");
            this.initialized = true;
            return true;
        } catch (initError) {
            error(`Failed to initialize Scoop SQLite cache: ${initError}`);
            if (this.db) {
                try {
                    this.db.close();
                } catch {}
                this.db = null;
            }
            this.initialized = true;
            throw initError; // Re-throw the error instead of returning false
        }
    }

    /**
     * Search for packages using Scoop's SQLite cache
     * Follows the exact same pattern as Scoop's Select-ScoopDBItem function
     * @param query Search query string
     * @returns Array of search results with only the latest versions
     */
    async search(query: string): Promise<SearchResult[]> {
        if (!this.db) {
            throw new Error("SQLite cache not initialized");
        }

        try {
            // Follow Scoop's exact pattern: if query is empty, use '%', otherwise wrap with '%'
            const searchPattern = query === "" ? "%" : `%${query}%`;

            // Replicate Scoop's exact SQL query structure from Select-ScoopDBItem
            // First: SELECT with LIKE clauses for name, binary, shortcut fields
            // Then: Wrap with ORDER BY version DESC and GROUP BY name, bucket
            const statement = this.db.query(`
                SELECT * FROM (
                    SELECT * FROM app 
                    WHERE name LIKE $pattern 
                       OR binary LIKE $pattern 
                       OR shortcut LIKE $pattern
                    ORDER BY version DESC
                ) GROUP BY name, bucket
            `);

            const results = statement.all({
                $pattern: searchPattern,
            }) as ScoopAppRecord[];

            return results.map(this.convertToSearchResult);
        } catch (searchError) {
            error(`Error searching Scoop SQLite cache: ${searchError}`);
            throw searchError;
        }
    }

    /**
     * Close the database connection
     */
    close(): void {
        if (this.db) {
            try {
                this.db.close();
            } catch (closeError) {
                error(`Error closing Scoop SQLite database: ${closeError}`);
            }
            this.db = null;
        }
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<{ packageCount: number; bucketCount: number } | null> {
        if (!this.db) {
            return null;
        }

        try {
            const packageCount = this.db.query("SELECT COUNT(*) as count FROM app").get() as {
                count: number;
            };
            const bucketCount = this.db
                .query("SELECT COUNT(DISTINCT bucket) as count FROM app")
                .get() as { count: number };

            return {
                packageCount: packageCount.count,
                bucketCount: bucketCount.count,
            };
        } catch (statsError) {
            error(`Error getting Scoop SQLite cache stats: ${statsError}`);
            return null;
        }
    }

    /**
     * Find Scoop installation directory
     */
    private findScoopRoot(): string | null {
        // Check SCOOP environment variable first
        const scoopEnv = process.env.SCOOP;
        if (scoopEnv && existsSync(scoopEnv)) {
            return scoopEnv;
        }

        // Check common user installation path
        const userProfile = process.env.USERPROFILE;
        if (userProfile) {
            const userScoopPath = join(userProfile, "scoop");
            if (existsSync(userScoopPath)) {
                return userScoopPath;
            }
        }

        // Check global installation path
        const globalScoopPath = "C:\\ProgramData\\scoop";
        if (existsSync(globalScoopPath)) {
            return globalScoopPath;
        }

        return null;
    }

    /**
     * Check if Scoop's SQLite cache is enabled
     */
    private async isSQLiteCacheEnabled(scoopRoot: string): Promise<boolean> {
        try {
            // Check user config first
            const userProfile = process.env.USERPROFILE;
            if (userProfile) {
                const userConfigPath = join(userProfile, ".config", "scoop", "config.json");
                if (existsSync(userConfigPath)) {
                    const configText = await Bun.file(userConfigPath).text();
                    const config = JSON.parse(configText);
                    if (config.use_sqlite_cache !== undefined) {
                        return config.use_sqlite_cache === true;
                    }
                }
            }

            // Check global config
            const globalConfigPath = join(scoopRoot, "apps", "scoop", "current", "config.json");
            if (existsSync(globalConfigPath)) {
                const configText = await Bun.file(globalConfigPath).text();
                const config = JSON.parse(configText);
                if (config.use_sqlite_cache !== undefined) {
                    return config.use_sqlite_cache === true;
                }
            }

            // Default is false
            return false;
        } catch (configError) {
            error(`Error checking Scoop SQLite cache configuration: ${configError}`);
            return false;
        }
    }

    /**
     * Convert Scoop app record to SearchResult format
     */
    private convertToSearchResult(record: ScoopAppRecord): SearchResult {
        const binaries = record.binary ? record.binary.split("|").filter(Boolean) : [];

        // Parse manifest to get homepage and other details
        let homepage = "";
        let license = "";
        try {
            const manifest = JSON.parse(record.manifest);
            homepage = manifest.homepage || "";
            license = manifest.license || "";
        } catch {
            // Ignore manifest parsing errors
        }

        return {
            name: record.name,
            version: record.version,
            description: record.description || "",
            bucket: record.bucket,
            binaries,
            scope: "user" as const, // Default to user scope
            isInstalled: false, // Will be determined by other logic
        };
    }
}
