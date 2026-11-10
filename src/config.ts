// What the server reads to know its vault: the plugin's option or `YAMI_WIKI_VAULT`, then the config file,
// then the working directory when it is a Yami vault. Pure functions over paths and JSON, so the tests
// run them with no vault.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export type Harness = "claude" | "codex";

/** What a person set with `wiki_vault` or by hand, in the config file. */
export interface Config {
  /** The vault, as an absolute path. */
  vault?: string;
  /** The harness that runs an ingest: `claude` (the default) or `codex`. */
  agent?: Harness;
}

/** The variable that names the vault: the plugin's option in Claude Code, or set by hand. */
export const VAULT_VARIABLE = "YAMI_WIKI_VAULT";
/** The variable that names the harness of an ingest: `claude` or `codex`. */
export const AGENT_VARIABLE = "YAMI_WIKI_AGENT";

/** The config file: `$XDG_CONFIG_HOME/yami-wiki/config.json`, or `~/.config/yami-wiki/config.json`. */
export function configPath(env: Record<string, string | undefined> = process.env): string {
  const base = setting(env.XDG_CONFIG_HOME) ?? path.join(setting(env.HOME) ?? homedir(), ".config");
  return path.join(base, "yami-wiki", "config.json");
}

/** The config file's content, or an empty config when the file is missing or does not parse. */
export function readConfig(file: string): Config {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object") return {};
    const { vault, agent } = parsed as Record<string, unknown>;
    return {
      ...(typeof vault === "string" && vault && { vault }),
      ...((agent === "claude" || agent === "codex") && { agent }),
    };
  } catch {
    return {};
  }
}

/** Writes the config file, and its folder when it is missing. */
export function writeConfig(file: string, config: Config): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * A setting's value, or undefined when it is empty or was never substituted: a plugin host that does not
 * know `${user_config.vault}` passes the text itself, which is no path.
 */
export function setting(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text && !text.includes("${") ? text : undefined;
}

/** `~` and `~/x` as the home folder, else the path as given. */
export function expandHome(file: string, home = homedir()): string {
  return file === "~" ? home : file.startsWith("~/") ? path.join(home, file.slice(2)) : file;
}

/** Whether a folder holds a Yami vault: Yami's folder settings, `.yami.json`, or the wiki module's default folder, `internal/wiki/`. */
export function isYamiVault(folder: string): boolean {
  return existsSync(path.join(folder, ".yami.json")) || isFolder(path.join(folder, "internal", "wiki"));
}

/**
 * Why a folder cannot be the vault, or undefined when it can: it is a folder, and an Obsidian vault
 * (`.obsidian/`) or a Yami vault (`.yami.json` or `internal/wiki/`). The server never turns another folder
 * into a vault: a mistyped path would get Yami's internal folder written into it.
 */
export function vaultProblem(folder: string): string | undefined {
  if (!isFolder(folder)) return `${folder} is not a folder.`;
  if (isYamiVault(folder) || isFolder(path.join(folder, ".obsidian"))) return undefined;
  return `${folder} is not an Obsidian vault: it has no .obsidian/ folder, no .yami.json, and no internal/wiki/ folder. Open it in Obsidian with Yami Wiki on first.`;
}

export type VaultSource = "option" | "config" | "cwd";

export interface ResolvedVault {
  /** The vault's root, absolute. */
  root: string;
  /** Where the path came from: the plugin's option or `YAMI_WIKI_VAULT`, the config file, or the working directory. */
  source: VaultSource;
}

export interface ResolveOptions {
  env: Record<string, string | undefined>;
  config: Config;
  cwd: string;
  home?: string;
}

/**
 * The vault the settings name: `YAMI_WIKI_VAULT` first (the plugin's option sets it), then the config file,
 * then the working directory when it is a Yami vault, so that an agent started inside a vault works in it.
 */
export function resolveVault({ env, config, cwd, home }: ResolveOptions): ResolvedVault | undefined {
  const option = setting(env[VAULT_VARIABLE]);
  if (option) return { root: path.resolve(cwd, expandHome(option, home)), source: "option" };
  if (config.vault) return { root: path.resolve(cwd, expandHome(config.vault, home)), source: "config" };
  if (isYamiVault(cwd)) return { root: path.resolve(cwd), source: "cwd" };
  return undefined;
}

/** The harness of an ingest: `YAMI_WIKI_AGENT`, then the config file, then `claude`. */
export function resolveAgent(env: Record<string, string | undefined>, config: Config): Harness {
  const variable = setting(env[AGENT_VARIABLE]);
  if (variable === "claude" || variable === "codex") return variable;
  return config.agent ?? "claude";
}

function isFolder(folder: string): boolean {
  try {
    return statSync(folder).isDirectory();
  } catch {
    return false;
  }
}

/** Whether a file or folder exists. */
export function exists(file: string): boolean {
  return existsSync(file);
}
