import { $ } from "bun";

await $`rm -rf dist`;

const packageJsonFile = Bun.file("package.json");
const packageJson = await packageJsonFile.json();

const version = process.env.SWB_VERSION ?? `${Date.now()}-dev`;

if (process.env.SWB_VERSION && process.env.SWB_VERSION !== packageJson.version) {
    console.log(
        `Updating package.json version from ${packageJson.version} to ${process.env.SWB_VERSION}`
    );
    packageJson.version = process.env.SWB_VERSION;
    await Bun.write("package.json", JSON.stringify(packageJson, null, 4) + "\n");
}

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
