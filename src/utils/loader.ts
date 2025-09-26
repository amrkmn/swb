import Logger from "./logger";

/**
 * Loading state utility that uses Logger.write
 * Creates a "Checking for updates." style animation
 */
export class Loading {
    private timer?: NodeJS.Timeout;
    private dots = 0;
    private running = false;

    constructor(
        private message: string,
        private interval = 100
    ) {}

    start() {
        if (this.running) return;
        this.running = true;

        this.timer = setInterval(() => {
            const dots = ".".repeat(this.dots % 4); // cycles 0–3
            process.stdout.write(`\r\x1b[2K${this.message}${dots}\r`);
            this.dots++;
        }, this.interval);
    }

    succeed(successMessage?: string) {
        this.stop();
        Logger.success(successMessage || `${this.message} done`);
    }

    fail(failMessage?: string) {
        this.stop();
        Logger.error(failMessage || `${this.message} failed`);
    }

    stop() {
        if (this.timer) clearInterval(this.timer);
        this.running = false;
        process.stdout.write("\r\x1b[2K"); // clear leftover dots before final log
    }
}
