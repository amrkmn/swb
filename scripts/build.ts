import { $ } from "bun";
import pkg from "../package.json";

await $`rm -rf dist`;

const version = process.env.SWB_VERSION ?? pkg.version ?? "0.0.0";

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
