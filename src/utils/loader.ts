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

/**
 * Progress bar utility for tracking completion
 * Creates a visual progress bar like: Checking apps [========--------] 8/16
 */
export class ProgressBar {
    private current = 0;
    private running = false;
    private currentStep: string;
    private readonly barWidth = 30;

    constructor(
        private total: number,
        private message: string = "Progress"
    ) {
        this.currentStep = message;
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.render();
    }

    increment(amount = 1) {
        this.current = Math.min(this.current + amount, this.total);
        if (this.running) {
            this.render();
        }
    }

    setProgress(current: number, step?: string) {
        this.current = Math.min(current, this.total);
        if (step) {
            this.currentStep = step;
        }
        if (this.running) {
            this.render();
        }
    }

    setStep(step: string) {
        this.currentStep = step;
        if (this.running) {
            this.render();
        }
    }

    private render() {
        const percent = this.total > 0 ? this.current / this.total : 0;
        const filled = Math.round(percent * this.barWidth);
        const empty = this.barWidth - filled;

        const filledBar = "=".repeat(filled);
        const emptyBar = "-".repeat(empty);
        const bar = `[${filledBar}${emptyBar}]`;

        const counter = `${this.current}/${this.total}`;
        process.stdout.write(`\r\x1b[2K${this.currentStep} ${bar} ${counter}`);
    }

    stop() {
        this.running = false;
        process.stdout.write("\r\x1b[2K");
    }

    complete() {
        this.current = this.total;
        this.render();
        this.stop();
    }
}
