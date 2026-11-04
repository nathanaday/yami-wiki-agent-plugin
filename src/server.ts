// The MCP server of the plugin, over stdio: the wiki tools of the vault that the settings name, for Claude
// Code and Codex. `node dist/server.mjs [--vault <folder>]`.
import { parseArgs } from "node:util";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { runTool } from "yami/agent";
import { Host } from "./host.js";
import { instructions, serverTools } from "./tools.js";

declare const __VERSION__: string;

// stdout is the transport: a line of anything else breaks the connection. The library logs with
// console.error; this catches a stray console.log of a dependency.
console.log = console.info = console.debug = (...args: unknown[]) => console.error(...args);

// Claude Code marks its processes, and a `claude` that starts inside one refuses to run. The server is such
// a process when Claude Code runs it, and an ingest starts a `claude` of its own, so the mark goes.
delete process.env.CLAUDECODE;

const { values } = parseArgs({ options: { vault: { type: "string" } } });
const host = new Host({ vault: values.vault });

const server = new McpServer({ name: "yami-wiki", version: __VERSION__ }, { instructions: instructions(host) });
for (const tool of serverTools(host)) {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.input,
      annotations: { readOnlyHint: tool.readOnly === true, destructiveHint: false, openWorldHint: false },
    },
    async (input, extra) => {
      const { text, isError } = await runTool(tool, input, extra.signal);
      return { content: [{ type: "text", text }], isError };
    },
  );
}

let closing: Promise<void> | undefined;
async function shutdown(code = 0): Promise<void> {
  closing ??= host.close().catch((error: unknown) => console.error("yami-wiki: closing the vault failed", error));
  await closing;
  process.exit(code);
}

const transport = new StdioServerTransport();
transport.onclose = () => void shutdown();
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
await server.connect(transport);
