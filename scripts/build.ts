import { $ } from "bun";

await $`rm -rf dist`;

const packageJsonFile = Bun.file("package.json");
const packageJson = await packageJsonFile.json();

// Use SWB_VERSION env var if set, otherwise use package.json version
const version = process.env.SWB_VERSION ?? packageJson.version;

console.log(`Building SWB v${version}...`);

await Bun.build({
    entrypoints: ["src/cli.ts", "src/lib/search/worker.ts"],
    minify: true,
    outdir: "dist",
    target: "bun",
    define: {
        SWB_VERSION: `"${version}"`,
    },
});

console.log(`Build complete: dist/cli.js (v${version})`);
