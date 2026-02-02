import type { AppsService } from "src/services/AppsService";
import type { BucketService } from "src/services/BucketService";
import type { CleanupService } from "src/services/CleanupService";
import type { ConfigService } from "src/services/ConfigService";
import type { ManifestService } from "src/services/ManifestService";
import type { ShimService } from "src/services/ShimService";
import type { WorkerService } from "src/services/WorkerService";

/**
 * Interface for the application logger.
 */
export interface Logger {
    log(...args: any[]): void;
    info(...args: any[]): void;
    success(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    debug(...args: any[]): void;
    verbose(...args: any[]): void;
    header(...args: any[]): void;
    newline(): void;
}

/**
 * Base Service class.
 */
export abstract class Service {
    constructor(protected ctx: Context) {}
}

/**
 * Dependency Injection Container.
 */
export interface Context {
    version: string;
    logger: Logger;
    // Global flags
    verbose: boolean;
    services: {
        workers: WorkerService;
        buckets: BucketService;
        apps: AppsService;
        config: ConfigService;
        cleanup: CleanupService;
        manifests: ManifestService;
        shims: ShimService;
        [key: string]: Service | any;
    };
}
