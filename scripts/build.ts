import { $ } from "bun";

// Clean dist directory
await $`rm -rf dist`;

// Read current package.json
const packageJsonFile = Bun.file("package.json");
const packageJson = await packageJsonFile.json();

// Determine version: use env variable if provided, else default to "dev"
const version = process.env.SWB_VERSION ?? "dev";

// Update package.json version if SWB_VERSION is provided and different from current
if (process.env.SWB_VERSION && process.env.SWB_VERSION !== packageJson.version) {
    console.log(
        `Updating package.json version from ${packageJson.version} to ${process.env.SWB_VERSION}`
    );

    // Update the version in the package object
    packageJson.version = process.env.SWB_VERSION;

    // Write the updated package.json back to file
    await Bun.write("package.json", JSON.stringify(packageJson, null, 4) + "\n");
}

console.log(`Building SWB v${version}...`);

// Build the executable
Bun.build({
    entrypoints: ["./src/cli.ts"],
    compile: {
        target: "bun-windows-x64",
        outfile: "dist/swb",
    },
    define: {
        SWB_VERSION: `"${version}"`,
    },
});

console.log(`Build complete: dist/swb.exe (v${version})`);
