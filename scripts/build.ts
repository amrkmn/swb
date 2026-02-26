import { $ } from "bun";

await $`rm -rf dist`;

const packageJsonFile = Bun.file("package.json");
const packageJson = await packageJsonFile.json();

const version = process.env.SWB_VERSION ?? packageJson.version;

// Parse command line flags
const baselineFlag = process.argv.includes("--baseline");
const arm64Flag = process.argv.includes("--arm64");

// Determine target based on flag
const target: Bun.Build.CompileTarget = arm64Flag
    ? "bun-windows-arm64"
    : baselineFlag
      ? "bun-windows-x64-baseline"
      : "bun-windows-x64";
const variant = arm64Flag ? "ARM64" : baselineFlag ? "Baseline" : "AVX2";

console.log(`Building SWB v${version} (${variant})...`);

// Bun's virtual filesystem root path for Windows
const bunfsRoot = "B:/~BUN/root";

const result = await Bun.build({
    entrypoints: [
        "src/cli.ts",
        "src/workers/search.ts",
        "src/workers/status.ts",
        "src/workers/bucket/info.ts",
        "src/workers/bucket/update.ts",
    ],
    minify: true,
    compile: {
        target: target,
        outfile: "swb.exe",
    },
    outdir: "dist",
    define: {
        SWB_VERSION: `"${version}"`,
        SWB_WORKER_PATH: `"${bunfsRoot}/workers"`,
    },
});

if (!result.success) {
    console.error("Build failed:", result.logs);
    process.exit(1);
}

console.log(`\n✓ Built: dist/swb.exe (${variant})`);
console.log(`Target: ${target}`);
