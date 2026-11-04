// Bundles the server into dist/server.mjs, one file that runs on Node 22 with no install: a plugin is
// copied into a cache when it is installed, and nothing runs npm there. The file is committed; CI checks
// that it is the build of the source.
import { readFileSync } from "node:fs";
import esbuild from "esbuild";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));

await esbuild.build({
  entryPoints: ["src/server.ts"],
  outfile: "dist/server.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  minify: true,
  sourcemap: false,
  legalComments: "none",
  logLevel: "info",
  define: { __VERSION__: JSON.stringify(version) },
  loader: { ".md": "text" },
  // The dependencies that esbuild converts from CommonJS call require at run time, which an ES module lacks.
  banner: { js: ['#!/usr/bin/env node', 'import { createRequire as __createRequire } from "node:module";', "const require = __createRequire(import.meta.url);"].join("\n") },
});
