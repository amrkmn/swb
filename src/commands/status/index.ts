import { Command } from "src/core/Command";
import type { Context, Logger } from "src/core/Context";
import type { InstalledAppInfo } from "src/services/WorkerService";
import { ProgressBar } from "src/utils/loader";
import { bold, cyan, green, red, yellow } from "src/utils/colors";
import { formatLineColumns } from "src/utils/helpers";
import { z } from "zod";

const StatusArgs = z.object({});
const StatusFlags = z.object({
    local: z.boolean().default(false),
    verbose: z.boolean().default(false),
});

export class StatusCommand extends Command<typeof StatusArgs, typeof StatusFlags> {
    name = "status";
    description = "Check for new versions of installed apps";
    argsSchema = StatusArgs;
    flagsSchema = StatusFlags;

    flagAliases = {
        l: "local",
        v: "verbose",
    };

    async run(ctx: Context, _args: z.infer<typeof StatusArgs>, flags: z.infer<typeof StatusFlags>) {
        const { logger, services } = ctx;
        const appsService = services.apps;
        const bucketService = services.buckets;
        const workerService = services.workers;
        const isLocal = flags.local;

        // 1. Get installed apps
        const installed = appsService.listInstalled();

        if (installed.length === 0) {
            logger.warn("No packages installed.");
            return 0;
        }

        // 2. Set up progress bar: 2 steps (scoop + buckets) + number of apps
        const totalSteps = 2 + installed.length;
        const progressBar = new ProgressBar(totalSteps, "Checking Scoop");
        progressBar.start();

        // 3. Check Scoop and bucket status
        let status: { scoopOutdated: boolean; bucketsOutdated: boolean };
        if (isLocal) {
            progressBar.setProgress(2);
            status = { scoopOutdated: false, bucketsOutdated: false };
        } else {
            progressBar.setStep("Checking Scoop");
            const scoopOutdated = await bucketService.checkScoopStatus();
            progressBar.setProgress(1);

            progressBar.setStep("Checking buckets");
            const bucketsOutdated = await bucketService.checkBucketsStatus();
            status = { scoopOutdated, bucketsOutdated };
            progressBar.setProgress(2);
        }

        // 4. Prepare for worker
        const workerApps: InstalledAppInfo[] = installed.map(app => ({
            name: app.name,
            version: app.version || "0.0.0",
            scope: app.scope,
            currentPath: app.currentPath || "",
            bucket: app.bucket || undefined,
        }));

        // 5. Run parallel check with progress
        progressBar.setStep("Checking apps");
        const results = await workerService.checkStatus(workerApps, count => {
            progressBar.setProgress(2 + count);
        });

        progressBar.complete();

        // 6. Display Scoop and bucket status
        this.displayScoopAndBucketStatus(logger, status);

        // 6. Filter and Format Results
        const updates = results.filter(r => r.outdated || r.failed || r.missingDeps.length > 0);

        if (updates.length === 0) {
            logger.success("All packages are okay and up to date.");
            return 0;
        }

        logger.log(`Found ${updates.length} potential updates:`);
        logger.newline();

        const tableData: string[][] = [
            ["Name", "Installed", "Latest", "Missing Dependencies", "Info"].map(h =>
                bold(green(h))
            ),
        ];

        for (const res of updates) {
            const name = res.outdated ? yellow(res.name) : cyan(res.name);
            const current = res.installedVersion || "???";
            const latest = res.latestVersion || "???";

            let latestStr = latest;
            if (res.outdated) {
                latestStr = `* ${latest}`;
            }

            const deps = res.missingDeps.length > 0 ? res.missingDeps.join(", ") : "";

            const infoParts: string[] = [...res.info];
            if (res.failed) infoParts.push(red("Failed"));
            if (res.held) infoParts.push(yellow("Held"));
            const info = infoParts.join(", ");

            tableData.push([name, current, latestStr, deps, info]);
        }

        const formattedTable = formatLineColumns(tableData, {
            weights: [2.0, 1.0, 1.0, 1.0, 1.5],
        });

        logger.log(formattedTable);
        logger.newline();

        return 0;
    }

    private displayScoopAndBucketStatus(
        logger: Logger,
        status: { scoopOutdated: boolean; bucketsOutdated: boolean }
    ): void {
        const { scoopOutdated, bucketsOutdated } = status;

        // Display Scoop status
        if (scoopOutdated) {
            logger.log("Scoop is out of date. Run 'scoop update' to get latest version.");
        } else {
            logger.success("Scoop is up to date.");
        }

        // Display bucket status
        if (bucketsOutdated) {
            logger.log("Bucket(s) are out of date. Run 'scoop update' to get latest changes.");
        } else {
            logger.success("All buckets are up to date.");
        }
    }
}
