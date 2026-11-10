import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { configPath, expandHome, readConfig, resolveAgent, resolveVault, setting, vaultProblem, writeConfig } from "../../src/config.ts";

const folders: string[] = [];
function folder(...files: string[]): string {
  const root = mkdtempSync(path.join(tmpdir(), "yami-wiki-config-"));
  folders.push(root);
  for (const file of files) mkdirSync(path.join(root, file), { recursive: true });
  return root;
}
afterEach(() => {
  for (const root of folders.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("the settings", () => {
  it("treats an empty or unsubstituted value as unset", () => {
    expect(setting(undefined)).toBeUndefined();
    expect(setting("  ")).toBeUndefined();
    expect(setting("${user_config.vault}")).toBeUndefined();
    expect(setting(" /Vaults/Notes ")).toBe("/Vaults/Notes");
  });

  it("expands ~ to the home folder", () => {
    expect(expandHome("~/Vaults/Notes", "/Users/me")).toBe("/Users/me/Vaults/Notes");
    expect(expandHome("~", "/Users/me")).toBe("/Users/me");
    expect(expandHome("/Vaults/~x", "/Users/me")).toBe("/Vaults/~x");
  });

  it("puts the config file under XDG_CONFIG_HOME, or ~/.config", () => {
    expect(configPath({ XDG_CONFIG_HOME: "/xdg", HOME: "/home/me" })).toBe("/xdg/yami-wiki/config.json");
    expect(configPath({ HOME: "/home/me" })).toBe("/home/me/.config/yami-wiki/config.json");
  });

  it("reads and writes the config file, and reads a missing or broken one as empty", () => {
    const root = folder();
    const file = path.join(root, "deep", "config.json");
    expect(readConfig(file)).toEqual({});
    writeConfig(file, { vault: "/Vaults/Notes", agent: "codex" });
    expect(readFileSync(file, "utf8")).toBe('{\n  "vault": "/Vaults/Notes",\n  "agent": "codex"\n}\n');
    expect(readConfig(file)).toEqual({ vault: "/Vaults/Notes", agent: "codex" });
    writeFileSync(file, "{ not json");
    expect(readConfig(file)).toEqual({});
    writeFileSync(file, JSON.stringify({ vault: 3, agent: "gemini" }));
    expect(readConfig(file)).toEqual({});
  });
});

describe("the vault", () => {
  it("is the option, then the config, then a working directory that is a Yami vault", () => {
    const option = folder(".obsidian");
    const configured = folder(".obsidian");
    const cwd = folder("internal/wiki");
    const plain = folder();
    expect(resolveVault({ env: { YAMI_WIKI_VAULT: option }, config: { vault: configured }, cwd })).toEqual({ root: option, source: "option" });
    expect(resolveVault({ env: { YAMI_WIKI_VAULT: "${user_config.vault}" }, config: { vault: configured }, cwd })).toEqual({ root: configured, source: "config" });
    expect(resolveVault({ env: {}, config: {}, cwd })).toEqual({ root: cwd, source: "cwd" });
    expect(resolveVault({ env: {}, config: {}, cwd: plain })).toBeUndefined();
  });

  it("resolves ~ and a relative path", () => {
    expect(resolveVault({ env: { YAMI_WIKI_VAULT: "~/Vaults/Notes" }, config: {}, cwd: "/work", home: "/Users/me" })).toEqual({ root: "/Users/me/Vaults/Notes", source: "option" });
    expect(resolveVault({ env: {}, config: { vault: "../Notes" }, cwd: "/work/repo" })).toEqual({ root: "/work/Notes", source: "config" });
  });

  it("must be a folder that is an Obsidian vault or a Yami vault", () => {
    const obsidian = folder(".obsidian");
    const yami = folder("internal/wiki");
    const plain = folder();
    expect(vaultProblem(obsidian)).toBeUndefined();
    expect(vaultProblem(yami)).toBeUndefined();
    expect(vaultProblem(plain)).toMatch(/is not an Obsidian vault: it has no \.obsidian\/ folder, no \.yami\.json, and no internal\/wiki\/ folder/);
    const moved = folder();
    writeFileSync(path.join(moved, ".yami.json"), '{ "wiki": "library/wiki" }');
    expect(vaultProblem(moved)).toBeUndefined();
    expect(vaultProblem(path.join(plain, "missing"))).toMatch(/is not a folder\.$/);
    writeFileSync(path.join(plain, "file"), "");
    expect(vaultProblem(path.join(plain, "file"))).toMatch(/is not a folder\.$/);
  });
});

describe("the agent of an ingest", () => {
  it("is the variable, then the config, then claude", () => {
    expect(resolveAgent({ YAMI_WIKI_AGENT: "codex" }, { agent: "claude" })).toBe("codex");
    expect(resolveAgent({ YAMI_WIKI_AGENT: "gemini" }, { agent: "codex" })).toBe("codex");
    expect(resolveAgent({}, {})).toBe("claude");
  });
});
