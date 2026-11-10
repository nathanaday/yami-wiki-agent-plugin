// The server's tools over a copy of the fixture vault: the vault report, the wiki module's tools run on the
// connected vault, the reads the server adds, and a switch of vault. No harness: nothing here runs an agent.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runTool, type AgentTool } from "yami/agent";
import { Host } from "../../src/host.ts";
import { instructions, serverTools, wikiToolDefinitions } from "../../src/tools.ts";

const FIXTURE = "test/fixtures/vault";
const signal = new AbortController().signal;

let scratch: string;
let vault: string;
let configFile: string;
let host: Host | undefined;

beforeEach(() => {
  scratch = mkdtempSync(path.join(tmpdir(), "yami-wiki-tools-"));
  vault = path.join(scratch, "Notes");
  cpSync(FIXTURE, vault, { recursive: true });
  configFile = path.join(scratch, "config", "config.json");
});
afterEach(async () => {
  await host?.close();
  host = undefined;
  rmSync(scratch, { recursive: true, force: true });
});

function tools(h: Host): Record<string, AgentTool> {
  return Object.fromEntries(serverTools(h).map((tool) => [tool.name, tool]));
}
async function call(tool: AgentTool, input: unknown): Promise<any> {
  const result = await runTool(tool, input, signal);
  expect(result.isError, result.text).toBe(false);
  return JSON.parse(result.text);
}

describe("the tool list", () => {
  it("is the vault, the wiki module's tools, and the reads, with the module's definitions and no vault needed", () => {
    const names = serverTools(new Host({ env: {}, cwd: scratch, configFile })).map((tool) => tool.name);
    expect(names).toEqual(["wiki_vault", "wiki_search", "wiki_match", "wiki_lint", "wiki_tags", "wiki_templates", "wiki_neighbors", "wiki_chunks", "wiki_citations", "wiki_change", "wiki_ingest", "wiki_figure", "wiki_export", "wiki_import", "wiki_checkout", "wiki_read", "wiki_changes"]);
    const search = wikiToolDefinitions().find((tool) => tool.name === "wiki_search")!;
    expect(search.readOnly).toBe(true);
    expect(search.description).toContain("Ranked search over every note of the vault");
    expect(existsSync(path.join(tmpdir(), "yami-wiki-no-vault"))).toBe(false);
  });
});

describe("with no vault", () => {
  it("every wiki tool says how to connect one, and wiki_vault reports none", async () => {
    host = new Host({ env: {}, cwd: scratch, configFile });
    const t = tools(host);
    for (const name of ["wiki_search", "wiki_read", "wiki_changes"]) {
      const result = await runTool(t[name]!, name === "wiki_search" ? { text: "levain" } : name === "wiki_read" ? { note: "Levain" } : {}, signal);
      expect(result.isError, name).toBe(true);
      expect(result.text).toMatch(/^No vault is connected\. Call wiki_vault with set/);
    }
    const report = await call(t.wiki_vault!, {});
    expect(report).toEqual({ vault: null, problem: expect.stringContaining("wiki_vault"), config: configFile });
    expect(instructions(host)).toContain("No vault is connected");
  });

  it("names a folder that is no vault, and where the path came from", async () => {
    const plain = path.join(scratch, "plain");
    mkdirSync(plain);
    host = new Host({ env: { YAMI_WIKI_VAULT: plain }, cwd: scratch, configFile });
    const result = await runTool(tools(host).wiki_search!, { text: "x" }, signal);
    expect(result).toEqual({ isError: true, text: `${plain} is not an Obsidian vault: it has no .obsidian/ folder, no .yami.json, and no internal/wiki/ folder. Open it in Obsidian with Yami Wiki on first. (from the plugin's vault option or YAMI_WIKI_VAULT)` });
  });
});

describe("with the vault of the option", () => {
  beforeEach(() => {
    host = new Host({ env: { YAMI_WIKI_VAULT: vault }, cwd: scratch, configFile });
  });

  it("reports the vault and its counts, and enables the wiki module in it as the Obsidian plugin does", async () => {
    const report = await call(tools(host!).wiki_vault!, {});
    expect(report).toEqual({ vault, source: "from the plugin's vault option or YAMI_WIKI_VAULT", notes: 5, pages: 2, sources: 1, proposed: 0, agent: "claude", config: configFile });
    expect(existsSync(path.join(vault, "internal", "wiki", "wiki.md"))).toBe(true);
    expect(existsSync(path.join(vault, "internal", "wiki", "skills", "ingest", "SKILL.md"))).toBe(true);
    expect(existsSync(path.join(vault, "Yami.base"))).toBe(false);
    expect(existsSync(configFile), "the option writes no config").toBe(false);
    expect(instructions(host!)).toContain(`The vault is ${vault} (from the plugin's vault option or YAMI_WIKI_VAULT).`);
  });

  it("searches, matches, lints, and lists the tags with the module's tools", async () => {
    const t = tools(host!);
    const { hits, algorithm } = await call(t.wiki_search!, { text: "ripe levain", limit: 2 });
    expect(algorithm).toBe("bm25");
    expect(hits[0].path).toBe("wiki/pages/Levain.md");
    const { matches } = await call(t.wiki_match!, { names: ["Preferment", "Croissant"] });
    expect(matches.map((m: any) => [m.name, m.match, m.path])).toEqual([["Preferment", "hit", "wiki/pages/Levain.md"], ["Croissant", "new", undefined]]);
    const { findings } = await call(t.wiki_lint!, { folder: "wiki/pages" });
    expect(Array.isArray(findings)).toBe(true);
    const { tags } = await call(t.wiki_tags!, {});
    expect(tags.map((tag: any) => tag.tag)).toContain("baking/sourdough");
  });

  it("reads a note by path or by link, with its file on disk", async () => {
    const t = tools(host!);
    const byLink = await call(t.wiki_read!, { note: "[[Levain|the levain]]" });
    expect(byLink).toMatchObject({ path: "wiki/pages/Levain.md", file: path.join(vault, "wiki/pages/Levain.md"), properties: { type: "topic", aliases: ["Preferment"] } });
    expect(byLink.body).toContain("# Levain");
    const byPath = await call(t.wiki_read!, { note: "notes/Observing log.md" });
    expect(byPath.properties).toEqual({ tags: ["astronomy"] });
    expect(byPath.body).toContain("Lassen");
    const session = await call(t.wiki_read!, { note: "internal/wiki/wiki" });
    expect(session.properties.type).toBe("module");
    const missing = await runTool(t.wiki_read!, { note: "Croissant" }, signal);
    expect(missing).toEqual({ isError: true, text: "Croissant is not a note of the vault. wiki_search finds notes by their content, and wiki_match by their names." });
  });

  it("proposes a change with the module's tool, which wiki_changes then lists, and nothing under wiki/ changes", async () => {
    const t = tools(host!);
    expect((await call(t.wiki_changes!, {})).changes).toEqual([]);
    const proposal = await call(t.wiki_change!, {
      title: "Add Autolyse",
      notes: "A term the book uses.",
      writes: [{ op: "create", path: "wiki/pages/Autolyse.md", properties: { description: "A rest of flour and water before the salt and the levain go in.", tags: ["baking/sourdough"], sources: ["[[Bread book (source)]]"] }, body: "# Autolyse\n\nFlour and water rest before the rest goes in ([[Bread book (source)]]).\n", why: "the book's term" }],
    });
    expect(proposal).toMatchObject({ status: "proposed", creates: 1, modifies: 0, removes: 0 });
    expect(existsSync(path.join(vault, "wiki/pages/Autolyse.md"))).toBe(false);
    const { changes, approval } = await call(t.wiki_changes!, {});
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ path: proposal.path, file: path.join(vault, proposal.path), title: "Add Autolyse", status: "proposed", label: "Waiting for approval", creates: 1 });
    expect(approval).toMatch(/^A person approves or rejects a proposed change in Obsidian/);
    expect((await call(t.wiki_vault!, {})).proposed).toBe(1);
    expect((await call(t.wiki_changes!, { status: "applied" })).changes).toEqual([]);
    const refused = await runTool(t.wiki_change!, { title: "Bad", writes: [{ op: "create", path: "notes/Elsewhere.md", body: "x" }] }, signal);
    expect(refused.isError).toBe(true);
  });

  it("switches to another vault with set, records it, and warns that the option wins at the next start", async () => {
    const t = tools(host!);
    await call(t.wiki_vault!, {});
    const other = path.join(scratch, "Other");
    cpSync(FIXTURE, other, { recursive: true });
    rmSync(path.join(other, "wiki", "pages", "Levain.md"));
    const report = await call(t.wiki_vault!, { set: other });
    expect(report).toMatchObject({ vault: other, source: `from ${configFile}`, pages: 1, warning: expect.stringContaining(`names ${vault}, which wins at the next start`) });
    expect(JSON.parse(readFileSync(configFile, "utf8"))).toEqual({ vault: other });
    const { hits } = await call(t.wiki_search!, { text: "levain" });
    expect(hits.map((hit: any) => hit.path)).not.toContain("wiki/pages/Levain.md");
    const plain = path.join(scratch, "plain");
    mkdirSync(plain);
    const refused = await runTool(t.wiki_vault!, { set: plain }, signal);
    expect(refused).toEqual({ isError: true, text: `${plain} is not an Obsidian vault: it has no .obsidian/ folder, no .yami.json, and no internal/wiki/ folder. Open it in Obsidian with Yami Wiki on first.` });
    expect((await call(t.wiki_vault!, {})).vault, "a refused set changes nothing").toBe(other);
  });
});

describe("with the vault of the config file", () => {
  it("connects to it, with the agent of the config, and set replaces it with no warning", async () => {
    mkdirSync(path.dirname(configFile), { recursive: true });
    const { writeConfig } = await import("../../src/config.ts");
    writeConfig(configFile, { vault: vault, agent: "codex" });
    host = new Host({ env: {}, cwd: scratch, configFile });
    const t = tools(host);
    expect(await call(t.wiki_vault!, {})).toMatchObject({ vault, source: `from ${configFile}`, agent: "codex" });
    const other = path.join(scratch, "Other");
    cpSync(FIXTURE, other, { recursive: true });
    const report = await call(t.wiki_vault!, { set: `${other}/` });
    expect(report.vault).toBe(other);
    expect(report.warning).toBeUndefined();
    expect(JSON.parse(readFileSync(configFile, "utf8"))).toEqual({ vault: other, agent: "codex" });
  });

  it("takes the working directory when it is a Yami vault and nothing else names one", async () => {
    mkdirSync(path.join(vault, "internal", "wiki"), { recursive: true });
    host = new Host({ env: {}, cwd: vault, configFile });
    expect(await call(tools(host).wiki_vault!, {})).toMatchObject({ vault, source: "the working directory" });
  });
});
