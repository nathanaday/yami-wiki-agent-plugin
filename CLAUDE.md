# yami-wiki-agent-plugin

A plugin for Claude Code and Codex: the wiki tools of Yami Wiki for an agent outside the vault. The library, the design, and the Obsidian plugins live in `github.com/nathanaday/yami` (`design.md` there is the design policy, and `yami/README.md` the API); read them first. This file holds what the code and the README do not say.

## Rules

- **The plugin is a host of the library, not a copy.** It builds a `Yami` over `FsVault` for the vault, with the wiki module and no threads, and serves the module's tools (`yami.tools()`, the `wiki_*` ones) over MCP. It writes no wiki code of its own: a search, a change, an ingest is the library's. Its own tools are `wiki_vault`, `wiki_read`, and `wiki_changes`, which exist because the agent's working directory is not the vault. A gap here is a gap in the library (design rule: "A gap in a plugin is a gap in the library"); `FsVault` comes from `yami/testing` because the library has no other entry for it yet.
- **A person approves in Obsidian.** The server has no approve or reject: the design says the knowledge base changes only through a plan a person approves, and an agent that could approve its own plan would break that. `wiki_changes` tells the agent what waits.
- **It never turns a folder into a vault.** `vaultProblem` requires `.obsidian/` or `internal/wiki/` before anything is written there. `yami.enable()` then writes the module's documents and `Yami.base` when they are missing, as the Obsidian plugin does.
- **The tool definitions come from a Yami over no vault**, so the server lists the same tools with or without a vault, and each call runs on the connection of the moment (`wikiToolDefinitions`, `wikiTools`). `wiki_vault set` swaps the connection under them. A tool with no vault answers with `host.noVault()`, which names `wiki_vault` and the skill.
- **The vault comes from three places, in order:** the plugin's option in Claude Code, which `.mcp.json` passes as `YAMI_WIKI_VAULT` (`${user_config.vault}`); the config file, `~/.config/yami-wiki/config.json`, which `wiki_vault set` writes; and the working directory when it is a Yami vault. A value that still holds `${` was never substituted (Codex knows no `user_config`) and counts as unset (`setting`). `--vault` on the command line comes before all three.
- **stdout is the transport.** `server.ts` sends `console.log` to stderr. Log with `console.error`.
- **`CLAUDECODE` is removed from the environment** at start, so the `claude` that an ingest starts does not refuse to run inside Claude Code's process tree.
- **`dist/server.mjs` is committed.** A plugin install copies the repository; nothing runs `npm install` there. `scripts/build.mjs` bundles the server for Node 22 as one ES module (with a `require` shim for the CommonJS dependencies). Build before you commit; CI checks `git diff --exit-code dist`.
- **Two manifests, one plugin.** `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` share the name `yami-wiki`, the version, and the description; `.mcp.json` serves both; `skills/` serves both. The marketplaces are `.claude-plugin/marketplace.json` (name `yami`, source `./`) and `.agents/plugins/marketplace.json`. A unit test holds the versions and names together, and `npm run set-version` sets them. The Codex manifest and marketplace follow the layout of published Codex plugins (`skills`, `mcpServers`, `interface`; `source.path`, `policy`); the official Codex docs were not reachable when they were written, so check them against `developers.openai.com/codex/plugins/build` when something does not load.
- **Skills are the plugin's only prose for the agent.** A skill says the steps and the tools, and never writes a file of the vault. `connect`, `ask`, `context`, `ingest`, `lint`.

## Build and test

```sh
npm install
npm run build          # tsc, then esbuild → dist/server.mjs
npm test               # builds, then vitest: config, tools over a copy of test/fixtures/vault, the built server over stdio, versions
claude plugin validate .   # the manifest and the marketplace
```

No test runs an agent: an ingest needs a real Claude Code or Codex. To try one, point the plugin at a copy of a vault (`claude --plugin-dir .`), run `/yami-wiki:ingest <file>`, and watch the session in Obsidian.
