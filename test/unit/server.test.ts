// The built server over stdio, as a harness runs it: the tool list, a search, and a read on a copy of the
// fixture vault, and the error of a server with no vault. Needs dist/server.mjs, which `npm test` builds.
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterEach, describe, expect, it } from "vitest";

const SERVER = path.resolve("dist/server.mjs");
const FIXTURE = "test/fixtures/vault";

let scratch: string;
const clients: Client[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.close();
  rmSync(scratch, { recursive: true, force: true });
});

async function start(env: Record<string, string>): Promise<Client> {
  const transport = new StdioClientTransport({ command: process.execPath, args: [SERVER], env: { ...(process.env as Record<string, string>), ...env }, stderr: "pipe" });
  const client = new Client({ name: "test", version: "0" });
  clients.push(client);
  await client.connect(transport);
  return client;
}

function text(result: Awaited<ReturnType<Client["callTool"]>>): string {
  const [first] = result.content as { type: string; text: string }[];
  return first!.text;
}

describe("the server over stdio", () => {
  it("lists the tools with the read-only ones marked, and searches and reads the vault", async () => {
    scratch = mkdtempSync(path.join(tmpdir(), "yami-wiki-server-"));
    const vault = path.join(scratch, "Notes");
    cpSync(FIXTURE, vault, { recursive: true });
    const client = await start({ YAMI_WIKI_VAULT: vault, XDG_CONFIG_HOME: path.join(scratch, "config") });
    expect(client.getServerVersion()).toMatchObject({ name: "yami-wiki" });
    expect(client.getInstructions()).toContain(`The vault is ${vault}`);
    const { tools } = await client.listTools();
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    expect(Object.keys(byName).sort()).toEqual(["wiki_change", "wiki_changes", "wiki_checkout", "wiki_chunks", "wiki_citations", "wiki_export", "wiki_figure", "wiki_import", "wiki_ingest", "wiki_lint", "wiki_match", "wiki_neighbors", "wiki_read", "wiki_search", "wiki_tags", "wiki_templates", "wiki_vault"]);
    expect(byName.wiki_search!.annotations).toMatchObject({ readOnlyHint: true });
    expect(byName.wiki_change!.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(byName.wiki_search!.inputSchema).toMatchObject({ type: "object", properties: { text: { type: "string" } } });

    const report = JSON.parse(text(await client.callTool({ name: "wiki_vault", arguments: {} })));
    expect(report).toMatchObject({ vault, notes: 5, pages: 2 });
    const search = JSON.parse(text(await client.callTool({ name: "wiki_search", arguments: { text: "wild yeast", limit: 1 } })));
    expect(search.hits[0].path).toBe("wiki/pages/Sourdough.md");
    const read = JSON.parse(text(await client.callTool({ name: "wiki_read", arguments: { note: "[[Sourdough]]" } })));
    expect(read.file).toBe(path.join(vault, "wiki/pages/Sourdough.md"));
    const invalid = await client.callTool({ name: "wiki_search", arguments: { limit: "ten" } });
    expect(invalid.isError).toBe(true);
  });

  it("starts with no vault, and each tool says how to connect one", async () => {
    scratch = mkdtempSync(path.join(tmpdir(), "yami-wiki-server-"));
    const client = await start({ YAMI_WIKI_VAULT: "", XDG_CONFIG_HOME: path.join(scratch, "config") });
    expect(client.getInstructions()).toContain("No vault is connected");
    const result = await client.callTool({ name: "wiki_search", arguments: { text: "x" } });
    expect(result.isError).toBe(true);
    expect(text(result)).toMatch(/^No vault is connected\. Call wiki_vault with set/);
    const report = JSON.parse(text(await client.callTool({ name: "wiki_vault", arguments: {} })));
    expect(report.vault).toBeNull();
  });
});
