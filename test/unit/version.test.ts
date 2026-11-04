import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const read = (file: string) => JSON.parse(readFileSync(file, "utf8")) as Record<string, any>;

// The release workflow publishes the version of .claude-plugin/plugin.json; every other file must agree.
it("the two manifests, package.json, and package-lock.json name one version", () => {
  const claude = read(".claude-plugin/plugin.json");
  const version = claude.version as string;
  expect(version, "a release tag has no v in front").toMatch(/^\d+\.\d+\.\d+$/);
  expect(read(".codex-plugin/plugin.json").version).toBe(version);
  expect(read("package.json").version).toBe(version);
  const lock = read("package-lock.json");
  expect(lock.version).toBe(version);
  expect(lock.packages[""].version).toBe(version);
});

it("the two manifests and the two marketplaces name one plugin, and the MCP server runs the built file", () => {
  const claude = read(".claude-plugin/plugin.json");
  const codex = read(".codex-plugin/plugin.json");
  expect(codex.name).toBe(claude.name);
  expect(codex.description).toBe(claude.description);
  expect(read(".claude-plugin/marketplace.json").plugins.map((p: any) => [p.name, p.source])).toEqual([[claude.name, "./"]]);
  expect(read(".agents/plugins/marketplace.json").plugins.map((p: any) => [p.name, p.source.path])).toEqual([[claude.name, "./"]]);
  const mcp = read(".mcp.json");
  expect(mcp.mcpServers["yami-wiki"]).toMatchObject({ command: "node", args: ["${CLAUDE_PLUGIN_ROOT}/dist/server.mjs"] });
});
