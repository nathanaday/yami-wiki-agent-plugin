# Yami Wiki for Claude Code and Codex

Your [Yami Wiki](https://github.com/nathanaday/yami-wiki) is an LLM wiki in your Obsidian vault: topics cited to sources, changed only through plans you approve. Inside the vault, every agent has the wiki tools. This plugin gives them to an agent outside the vault, so that Claude Code or Codex at work on a codebase, a paper, or any project can search your wiki, read its notes, gather the context for the task, lint it, and teach it a file.

It is one plugin for both agents: an MCP server with the wiki tools, and five skills that say how to use them. The server runs the same library as the Obsidian plugin, `yami`, over your vault's folder, so the tools are the ones the vault's agents have, with the same names, and a change it proposes is a change document in your vault that you approve in Obsidian.

## Install

You need Node 22 or later, and an Obsidian vault in which Yami Wiki is on, or has been on once (it has `internal/wiki/`). The plugin never turns another folder into a vault.

**Claude Code**

```sh
claude plugin marketplace add nathanaday/yami-wiki-agent-plugin
claude plugin install yami-wiki@yami
```

When the plugin is enabled, Claude Code asks for the **Vault**: the folder of your vault. You can leave it empty and connect from a session instead. `/config` changes it later.

**Codex**

```sh
codex plugin marketplace add nathanaday/yami-wiki-agent-plugin
codex plugin install yami-wiki
```

Then, in either one, point the tools at your vault once:

```
/yami-wiki:connect ~/Vaults/Notes
```

The server records the vault in `~/.config/yami-wiki/config.json` (or under `$XDG_CONFIG_HOME`), so every later session, in any project, works in it. The vault option of Claude Code, and the variable `YAMI_WIKI_VAULT`, come before the file. A session started inside a Yami vault works in that vault when nothing else names one.

## Use it

| Skill | What it does |
| --- | --- |
| `/yami-wiki:connect <folder>` | Points the tools at a vault, or says which vault they work in, with its counts and the change plans that wait. |
| `/yami-wiki:ask <question>` | Answers from the wiki, with a `[[link]]` on each claim, and says what the wiki does not cover. |
| `/yami-wiki:context <task>` | Gathers what the wiki knows that bears on a task outside the vault, such as work on a codebase, as a brief: the facts, decisions, and constraints with their notes, the wiki's names for things, the gaps, and what to read. |
| `/yami-wiki:ingest <files or folder>` | Teaches the wiki files from outside the vault: a project's docs, a paper, a deck. The ingest runs as a session of the wiki and proposes one change plan. |
| `/yami-wiki:lint` | The health of the wiki or of some notes, each finding with its fix. |

The agent also uses the tools on its own, as any agent in the vault does, since the server's instructions say how to answer from the wiki. The tools:

| Tool | What it does |
| --- | --- |
| `wiki_search`, `wiki_match`, `wiki_lint`, `wiki_tags`, `wiki_neighbors`, `wiki_chunks`, `wiki_change`, `wiki_ingest`, `wiki_checkout` | The wiki module's tools, as the vault's agents have them. The [library README](https://github.com/nathanaday/yami/blob/main/yami/README.md#the-wiki-module) describes each. |
| `wiki_vault` | The vault the server works in, with its counts. With `set`, another vault, recorded for the next start. |
| `wiki_read` | A note, whole, by its path or its `[[link]]`, with its file on disk. An agent outside the vault needs it, since the vault is not in its working directory. |
| `wiki_changes` | The change plans that wait for your approval, or every change. |

## What changes in your vault, and what does not

- **Nothing under `wiki/` changes without you.** `wiki_change` writes a change document under `internal/wiki/changes/` with `status: proposed`, and `wiki_ingest` runs an ingest session that proposes one. You approve or reject it in Obsidian: open the change document, or the Yami Wiki panel. The plugin has no tool that approves.
- **An ingest runs inside the server**, on your own Claude Code or Codex, as the Obsidian plugin runs one: a read-only session in your vault, with its policies, its promises, and a review. It records its work in the session document under `internal/wiki/sessions/` and in a conversation note, so you watch it in Obsidian. The run lives as long as the agent session that started it: when you end that session first, the ingest stops, and **Resume this session** in Obsidian continues it. `YAMI_WIKI_AGENT`, or `agent` in the config file, chooses `claude` (the default) or `codex`.
- **At its start, the server enables the wiki module in the vault**, as the Obsidian plugin does at load: it writes the module's documents under `internal/wiki/` and `Yami.base` when they are missing, and never overwrites a file you edited. Keep this plugin and the Obsidian plugin on the same version of the library, or each start may rewrite an unedited document to its own version's text.
- **Inside a vault, the agent sees the tools twice** when a conversation of Duet or Yami Wiki runs with this plugin on: the vault's own `yami` tools and this server's. They work on the same vault. Turn the plugin off for that project if it bothers you.

## Network use and privacy

The server connects to nothing. It reads and writes your vault's folder and its config file, and for an ingest it starts Claude Code or Codex on your computer, which send what they read to Anthropic or OpenAI under your own sign-in.

## Development

```sh
npm install        # takes yami from the release that package.json names
npm run build      # type-checks, and bundles the server into dist/server.mjs
npm test           # builds, then runs the unit tests, among them the built server over stdio
```

`dist/server.mjs` is committed: a plugin install copies the repository and runs no build, so the file in the repository is what runs. CI fails when it is not the build of the source. To try a build in a session, add the checkout as a plugin: `claude --plugin-dir /path/to/yami-wiki-agent-plugin`, or `codex plugin marketplace add /path/to/yami-wiki-agent-plugin`.

To release X.Y.Z: `npm run set-version X.Y.Z`, `npm run build`, commit, and push to `main`. The release workflow tags the commit `X.Y.Z` when no release has that version. Claude Code keeps users on a version until `plugin.json` names a new one.

## License

[MIT](LICENSE)
