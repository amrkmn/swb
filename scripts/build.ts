import { $ } from "bun";

await $`rm -rf dist`;

const packageJsonFile = Bun.file("package.json");
const packageJson = await packageJsonFile.json();

const version = process.env.SWB_VERSION ?? packageJson.version;

console.log(`Building SWB v${version}...`);
console.log("Building standalone executable...");

// Bun's virtual filesystem root path for Windows compiled binaries
const bunfsRoot = "B:/~BUN/root";

// Compile the main executable with workers embedded
const result = await Bun.build({
    entrypoints: ["src/cli.ts", "src/lib/workers/search.ts", "src/lib/workers/status.ts"],
    minify: true,
    target: "bun",
    compile: {
        outfile: "swb.exe",
    },
    outdir: "dist",
    define: {
        SWB_VERSION: `"${version}"`,
        SWB_WORKER_PATH: `"${bunfsRoot}/lib/workers"`,
    },
});

if (!result.success) {
    console.error("Build failed:", result.logs);
    process.exit(1);
}

console.log(`Build complete: dist/swb.exe (v${version})`);
console.log("Workers embedded in executable using Bun's virtual filesystem");
