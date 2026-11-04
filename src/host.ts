// The host of the wiki tools: one Yami over the vault that the settings name, built at the first call, and
// replaced when a person points the server at another vault.
import path from "node:path";
import { Yami, type AgentTool } from "yami";
import type { Agent } from "yami/agent";
import { ClaudeAgent } from "yami/agent/claude";
import { CodexAgent } from "yami/agent/codex";
import { FsVault } from "yami/testing";
import {
  AGENT_VARIABLE,
  configPath,
  expandHome,
  readConfig,
  resolveAgent,
  resolveVault,
  setting,
  VAULT_VARIABLE,
  vaultProblem,
  writeConfig,
  type Harness,
  type ResolvedVault,
  type VaultSource,
} from "./config.js";

/** One Yami over one vault, with the wiki tools that its module gives every agent. */
export interface Connection {
  root: string;
  source: VaultSource;
  yami: Yami;
  /** The harness that runs an ingest. */
  agent: Harness;
  /** The wiki module's tools by name: `wiki_search`, `wiki_match`, …, as the vault's own agents have them. */
  tools: Map<string, AgentTool>;
}

/** The error of a call with no vault: its message says how to connect one. */
export class NoVault extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoVault";
  }
}

export interface HostOptions {
  env?: Record<string, string | undefined>;
  cwd?: string;
  /** The config file. Default: `configPath(env)`. */
  configFile?: string;
  /** A vault named on the command line, which comes before every setting. */
  vault?: string;
  home?: string;
}

/** The agents of a connection: the harness of the config first, so an ingest runs on it. */
function agentsFor(agent: Harness): Agent[] {
  const claude = new ClaudeAgent();
  const codex = new CodexAgent();
  return agent === "codex" ? [codex, claude] : [claude, codex];
}

/** Builds a Yami over a vault, with the wiki module and no threads, and enables it, as the Obsidian plugin does at load. */
export async function connect(root: string, source: VaultSource, agent: Harness): Promise<Connection> {
  const yami = new Yami({ vault: new FsVault(root), agents: agentsFor(agent), threads: false });
  await yami.enable();
  const tools = new Map(yami.tools().tools.filter((tool) => tool.name.startsWith("wiki_")).map((tool) => [tool.name, tool]));
  return { root, source, yami, agent, tools };
}

/**
 * The server's vault. `current()` connects to the vault the settings name at the first call, so the server
 * starts with no vault and every tool says how to connect one. `use(folder)` connects to another vault
 * and records it in the config file, unless the plugin's option names the vault, which wins at each start.
 */
export class Host {
  readonly env: Record<string, string | undefined>;
  readonly cwd: string;
  readonly configFile: string;
  readonly home: string | undefined;
  readonly #vault: string | undefined;
  #connection: Connection | undefined;
  #connecting: Promise<Connection> | undefined;

  constructor(options: HostOptions = {}) {
    this.env = options.env ?? process.env;
    this.cwd = options.cwd ?? process.cwd();
    this.configFile = options.configFile ?? configPath(this.env);
    this.home = options.home;
    this.#vault = options.vault;
  }

  /** The vault the settings name now, and where the path comes from. */
  resolved(): ResolvedVault | undefined {
    if (this.#vault) return { root: path.resolve(this.cwd, expandHome(this.#vault, this.home)), source: "option" };
    return resolveVault({ env: this.env, config: readConfig(this.configFile), cwd: this.cwd, home: this.home });
  }

  /** The harness of an ingest, as the settings say now. */
  agent(): Harness {
    return resolveAgent(this.env, readConfig(this.configFile));
  }

  /** The message of a call with no vault. */
  noVault(): string {
    return `No vault is connected. Call wiki_vault with set: the folder of your Obsidian vault with Yami Wiki, such as "~/Vaults/Notes" (the skill /yami-wiki:connect does this). Or set the plugin's vault option in Claude Code, or ${VAULT_VARIABLE}.`;
  }

  /** The connection, made at the first call. Undefined when no setting names a vault. */
  async current(): Promise<Connection | undefined> {
    if (this.#connection) return this.#connection;
    if (!this.#connecting) {
      const resolved = this.resolved();
      if (!resolved) return undefined;
      const problem = vaultProblem(resolved.root);
      if (problem) throw new NoVault(`${problem} (${describeSource(resolved.source, this.configFile)})`);
      this.#connecting = connect(resolved.root, resolved.source, this.agent()).then((connection) => (this.#connection = connection));
      this.#connecting.catch(() => (this.#connecting = undefined));
    }
    return this.#connecting;
  }

  /** The connection, or the `NoVault` error that says how to connect. */
  async require(): Promise<Connection> {
    const connection = await this.current();
    if (!connection) throw new NoVault(this.noVault());
    return connection;
  }

  /** The named tool of the connection. */
  async tool(name: string): Promise<AgentTool> {
    const tool = (await this.require()).tools.get(name);
    if (!tool) throw new Error(`The wiki has no tool ${name}.`);
    return tool;
  }

  /**
   * Points the server at another vault: checks the folder, connects, records it in the config file, and
   * closes the connection before. When the plugin's option or `YAMI_WIKI_VAULT` names a vault, that path
   * wins at the next start, so the result says so.
   */
  async use(folder: string): Promise<{ connection: Connection; warning?: string }> {
    const root = path.resolve(this.cwd, expandHome(folder, this.home));
    const problem = vaultProblem(root);
    if (problem) throw new NoVault(problem);
    const connection = await connect(root, "config", this.agent());
    const before = this.#connection;
    this.#connection = connection;
    this.#connecting = Promise.resolve(connection);
    writeConfig(this.configFile, { ...readConfig(this.configFile), vault: root });
    if (before) await before.yami.close();
    const fixed = this.#vault ?? setting(this.env[VAULT_VARIABLE]);
    const warning =
      fixed && path.resolve(this.cwd, expandHome(fixed, this.home)) !== root
        ? `The server works in ${root} now, and the config file records it. But ${this.#vault ? "the command line" : `the plugin's vault option (${VAULT_VARIABLE})`} names ${fixed}, which wins at the next start: change it there too (in Claude Code, /config), or clear it.`
        : undefined;
    return { connection, warning };
  }

  /** Kills every live run and closes the agents. */
  async close(): Promise<void> {
    const connection = this.#connection ?? (await this.#connecting?.catch(() => undefined));
    this.#connection = undefined;
    this.#connecting = undefined;
    await connection?.yami.close();
  }
}

/** Where a vault path came from, for a message. */
export function describeSource(source: VaultSource, configFile: string): string {
  switch (source) {
    case "option":
      return `from the plugin's vault option or ${VAULT_VARIABLE}`;
    case "config":
      return `from ${configFile}`;
    case "cwd":
      return "the working directory";
  }
}

export { AGENT_VARIABLE, VAULT_VARIABLE };
