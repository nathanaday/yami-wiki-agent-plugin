// Sets the plugin's version in every file that holds it: the two manifests, package.json, and
// package-lock.json. Usage: npm run set-version 0.2.0
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(version ?? "")) {
  console.error("Usage: npm run set-version <major.minor.patch>, such as 0.2.0 (no v in front).");
  process.exit(1);
}
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const write = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

for (const file of [".claude-plugin/plugin.json", ".codex-plugin/plugin.json", "package.json"]) {
  const data = read(file);
  data.version = version;
  write(file, data);
}
const lock = read("package-lock.json");
lock.version = version;
if (lock.packages?.[""]) lock.packages[""].version = version;
write("package-lock.json", lock);

console.log(`Set ${version}. Run npm run build, commit dist/ with it, and push to main: the release follows.`);
