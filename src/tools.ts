// The tools the server offers: the wiki module's own, as the vault's agents have them, and three of the
// server's: `wiki_vault`, `wiki_read`, and `wiki_changes`, which an agent outside the vault needs.
import { tmpdir } from "node:os";
import path from "node:path";
import { defineTool, Yami, z, type AgentTool } from "yami";
import { readDocument } from "yami/document";
import { FsVault } from "yami/testing";
import { DEFAULT_FOLDERS, readFolders } from "yami/document";
import { CHANGE_STATUS_LABELS } from "yami/wiki";
import { describeSource, Host, NoVault, type Connection } from "./host.js";

/** How a person approves: the server has no act of approval, by design. */
export const APPROVAL = "A person approves or rejects a proposed change in Obsidian: open the change document, or the Yami Wiki panel.";

/** The report of `wiki_vault`. */
export interface VaultReport {
  vault: string;
  source: string;
  /** The notes the index holds. */
  notes: number;
  topics: number;
  sources: number;
  /** The change plans that wait for approval. */
  proposed: number;
  /** The harness that runs an ingest. */
  agent: string;
  config: string;
  warning?: string;
}

async function report(host: Host, connection: Connection, warning?: string): Promise<VaultReport> {
  const { wiki } = connection.yami;
  await wiki.refresh();
  const notes = wiki.notes;
  return {
    vault: connection.root,
    source: describeSource(connection.source, host.configFile),
    notes: notes.length,
    topics: notes.filter((note) => note.type === "topic").length,
    sources: notes.filter((note) => note.type === "source").length,
    proposed: (await wiki.changes()).length,
    agent: connection.agent,
    config: host.configFile,
    ...(warning && { warning }),
  };
}

/** An error as the result of a tool: the message, as `runTool` would give a thrown error, but typed for a reader. */
function failure(error: unknown): { text: string; isError: true } {
  return { text: error instanceof Error ? error.message : String(error), isError: true };
}

/**
 * The wiki module's tools with no vault: a Yami over a folder that does not exist, never enabled, gives the
 * definitions (name, description, input) that every vault's Yami gives. The server registers these, and
 * each call runs the tool of the connection at that moment, so `wiki_vault` can change the vault under them.
 */
export function wikiToolDefinitions(): AgentTool[] {
  const template = new Yami({ vault: new FsVault(path.join(tmpdir(), "yami-wiki-no-vault")), threads: false });
  return template.tools().tools.filter((tool) => tool.name.startsWith("wiki_"));
}

/** The wiki module's tools, each run on the host's vault of the moment. */
export function wikiTools(host: Host): AgentTool[] {
  return wikiToolDefinitions().map((definition) => ({
    ...definition,
    run: async (input, context) => {
      try {
        return await (await host.tool(definition.name)).run(input, context);
      } catch (error) {
        if (error instanceof NoVault) return failure(error);
        throw error;
      }
    },
  }));
}

/** The server's own tools: the vault, a note's text, and the changes that wait. */
export function hostTools(host: Host): AgentTool[] {
  return [
    defineTool({
      name: "wiki_vault",
      description: `The vault this server works in, with its counts: notes, topics, sources, and the change plans that wait for approval. With set, points the server at another vault: the folder of an Obsidian vault that has Yami Wiki (its .obsidian/ folder, .yami.json, or internal/wiki/ folder is checked first), recorded for the next start. Call it with nothing when a wiki tool says that no vault is connected, or to tell the user where the wiki is.`,
      input: { set: z.string().optional().describe("The vault to work in from now on: an absolute path, or one that starts with ~.") },
      title: ({ set }) => (set ? `Use the vault ${set.slice(0, 60)}` : "The wiki's vault"),
      run: async ({ set }) => {
        try {
          if (set) {
            const { connection, warning } = await host.use(set);
            return JSON.stringify(await report(host, connection, warning));
          }
          const connection = await host.current();
          if (!connection) return JSON.stringify({ vault: null, problem: host.noVault(), config: host.configFile });
          return JSON.stringify(await report(host, connection));
        } catch (error) {
          if (error instanceof NoVault) return failure(error);
          throw error;
        }
      },
    }),
    defineTool({
      name: "wiki_read",
      readOnly: true,
      description: `A note of the vault, whole: its properties and its body, with its vault path and its file on disk. Name it as a vault path or as a [[link]], as a search hit gives it. Use it to read the notes that wiki_search or wiki_match return, since the vault is outside your working directory; the file path also works with your Read tool. A note's original, such as a PDF a source embeds, is a file beside the note: wiki_chunks names it.`,
      input: { note: z.string().min(1).describe("The note, as a vault path or a [[link]] name.") },
      title: ({ note }) => `Read ${note.slice(0, 60)}`,
      run: async ({ note }) => {
        let connection: Connection;
        try {
          connection = await host.require();
        } catch (error) {
          if (error instanceof NoVault) return failure(error);
          throw error;
        }
        const { wiki, vault } = connection.yami;
        await wiki.refresh();
        const target = note.replace(/^!?\[\[/, "").replace(/\]\]$/, "").split(/[|#]/)[0]!.trim();
        const located = wiki.locate(target) ?? (await vault.exists(target) ? target : undefined) ?? (await vault.exists(`${target}.md`) ? `${target}.md` : undefined);
        if (!located) return { text: `${note} is not a note of the vault. wiki_search finds notes by their content, and wiki_match by their names.`, isError: true };
        const document = await readDocument(vault, located);
        return JSON.stringify({ path: located, file: path.join(connection.root, located), properties: document.properties, body: document.body });
      },
    }),
    defineTool({
      name: "wiki_changes",
      readOnly: true,
      description: `The change plans of the wiki: by default the proposals that wait for a person's approval, newest first, each with its document, its title, its counts, and the session that proposed it. With status, the changes of that status, or every change with all. ${APPROVAL} Use it to tell the user what waits for them after wiki_change or wiki_ingest, or to see whether a proposal went through.`,
      input: {
        status: z.enum(["proposed", "applying", "applied", "failed", "rejected", "all"]).optional().describe("Default proposed."),
        limit: z.number().int().positive().optional().describe("At most this many. Default 20."),
      },
      title: ({ status }) => `The ${status ?? "proposed"} changes of the wiki`,
      run: async ({ status = "proposed", limit = 20 }) => {
        let connection: Connection;
        try {
          connection = await host.require();
        } catch (error) {
          if (error instanceof NoVault) return failure(error);
          throw error;
        }
        const changes = await connection.yami.wiki.changes(status);
        return JSON.stringify({
          changes: changes.slice(0, limit).map((change) => ({
            path: change.path,
            file: path.join(connection.root, change.path),
            title: change.title,
            status: change.status,
            label: CHANGE_STATUS_LABELS[change.status],
            created: change.created,
            creates: change.creates,
            modifies: change.modifies,
            removes: change.removes,
            ...(change.session && { session: change.session }),
            ...(change.reason && { reason: change.reason }),
            ...(change.error && { error: change.error }),
          })),
          ...(changes.length > limit && { more: changes.length - limit }),
          approval: APPROVAL,
        });
      },
    }),
  ];
}

/** Every tool of the server, in the order the list shows them: the vault first, then the wiki's tools, then the reads. */
export function serverTools(host: Host): AgentTool[] {
  const [vault, ...own] = hostTools(host);
  return [vault!, ...wikiTools(host), ...own];
}

/** The instructions of the server, for the agent: what the vault is and how to work with it. */
export function instructions(host: Host): string {
  const resolved = host.resolved();
  const where = resolved ? `The vault is ${resolved.root} (${describeSource(resolved.source, host.configFile)}).` : host.noVault();
  let folders = DEFAULT_FOLDERS;
  try {
    if (resolved) folders = readFolders(resolved.root);
  } catch {
    // A bad .yami.json is the connection's to report, at the first tool call.
  }
  return [
    `The Yami wiki of an Obsidian vault: topics in ${folders.topics}/ cited to sources in ${folders.sources}/, and every other note of the vault, outside your working directory. ${where}`,
    `To answer from the wiki: wiki_search, then wiki_read the best notes (or Read <vault>/<path>), follow a link one hop when needed, and answer with a [[link]] on each claim. Say what the wiki does not cover instead of filling the gap from general knowledge without saying so. wiki_match says where names stand; wiki_neighbors walks the tags.`,
    `The wiki changes only through wiki_change, which proposes a change document, and wiki_ingest, which captures files and runs an ingest session that proposes one. ${APPROVAL} Never write a file of the vault yourself.`,
  ].join("\n");
}
