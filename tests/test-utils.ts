import { mock } from "bun:test";
import type { Context, Logger } from "src/core/Context";
import type { AppsService } from "src/services/AppsService";
import type { BucketService } from "src/services/BucketService";
import type { CleanupService } from "src/services/CleanupService";
import type { ConfigService } from "src/services/ConfigService";
import type { ManifestService } from "src/services/ManifestService";
import type { ShimService } from "src/services/ShimService";
import type { WorkerService } from "src/services/WorkerService";

export function createMockLogger(): Logger {
    return {
        log: mock(() => {}),
        info: mock(() => {}),
        success: mock(() => {}),
        warn: mock(() => {}),
        error: mock(() => {}),
        debug: mock(() => {}),
        verbose: mock(() => {}),
        header: mock(() => {}),
        newline: mock(() => {}),
    };
}

export function createMockContext(): Context {
    return {
        version: "1.0.0-test",
        logger: createMockLogger(),
        verbose: false,
        services: {
            apps: {} as AppsService,
            buckets: {} as BucketService,
            cleanup: {} as CleanupService,
            config: {} as ConfigService,
            manifests: {} as ManifestService,
            shims: {} as ShimService,
            workers: {} as WorkerService,
        },
    };
}
