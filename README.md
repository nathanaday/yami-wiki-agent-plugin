# Yami Wiki for Claude Code and Codex

[Yami Wiki](https://github.com/nathanaday/yami-wiki) keeps an LLM wiki in your Obsidian vault: topics cited to sources, changed only through plans you approve. Agents inside the vault can search and grow that wiki, but an agent at work in a codebase or a paper cannot see it. With this plugin, Claude Code or Codex in any project can answer from your wiki with a link on each claim, gather what the wiki knows before a task, check the wiki's health, and propose new topics from your files.

The plugin is an MCP server and five skills that say how to use its tools. The server runs the same library as the Obsidian plugin, [yami](https://github.com/nathanaday/yami), over your vault's folder, so its tools have the same names and behavior as the ones the vault's agents use. Nothing in the wiki changes until you approve the change in Obsidian.

## Requirements

- Node 22 or later.
- An Obsidian vault that has a `.obsidian/` folder, a `.yami.json` file, or an `internal/wiki/` folder. The server refuses any other folder, so a mistyped path never turns a random folder into a vault.
- Claude Code or Codex, signed in. An ingest runs on one of them.

## Install

**Claude Code**

```sh
claude plugin marketplace add nathanaday/yami-wiki-agent-plugin
claude plugin install yami-wiki@yami
```

When you enable the plugin, Claude Code asks for the **Vault** folder. You can leave it empty and connect from a session instead, and change it later with `/config`.

**Codex**

```sh
codex plugin marketplace add nathanaday/yami-wiki-agent-plugin
codex plugin add yami-wiki@yami
```

Codex has no plugin option for the vault, so connect from a session, or set `YAMI_WIKI_VAULT`.

## Configuration

The server takes its vault from the first of these that names one:

1. `YAMI_WIKI_VAULT`, which the Vault option of Claude Code sets.
2. `~/.config/yami-wiki/config.json` (or `$XDG_CONFIG_HOME/yami-wiki/config.json`), which connecting from a session writes.
3. The working directory, when it holds `.yami.json` or `internal/wiki/`.

Because the config file outlives the session, you connect once and every later session in any project uses that vault. An ingest runs on Claude Code by default; set `YAMI_WIKI_AGENT=codex`, or `"agent": "codex"` in the config file, to run it on Codex.

## First Use

Point the tools at your vault. In Claude Code:

```
/yami-wiki:connect ~/Vaults/Notes
```

In either agent you can also ask in words, such as "connect the wiki to ~/Vaults/Notes". The agent reports the vault, its counts, and the change plans that wait for you. Then ask a question the wiki can answer:

```
/yami-wiki:ask What did I decide about the cache layout?
```

The agent also uses the tools without a skill, since the server tells it how to answer from the wiki.

## Skills

| Skill | What it does |
| --- | --- |
| `connect <folder>` | Points the tools at a vault, or says which vault they use, with its counts and the change plans that wait. |
| `ask <question>` | Answers from the wiki with a `[[link]]` on each claim, and says what the wiki does not cover. |
| `context <task>` | Writes a brief of what the wiki knows that bears on a task outside the vault: facts, decisions, and constraints with their notes, the wiki's names for things, and the gaps. |
| `ingest <files or folder>` | Hands files from outside the vault, such as a project's docs or a paper, to an ingest session that proposes one change plan. |
| `lint` | Reports the wiki's health, or that of some notes, with a fix for each finding. |

In Claude Code each skill is a command such as `/yami-wiki:ask`.

## Tools

| Tool | What it does |
| --- | --- |
| `wiki_search`, `wiki_match`, `wiki_lint`, `wiki_tags`, `wiki_neighbors`, `wiki_chunks`, `wiki_citations`, `wiki_change`, `wiki_ingest`, `wiki_figure`, `wiki_export`, `wiki_import`, `wiki_checkout` | The wiki module's tools, as the vault's agents have them. The [library README](https://github.com/nathanaday/yami/blob/yami-0.23.0/yami/README.md#the-wiki-module) describes each. |
| `wiki_vault` | Reports the vault and its counts. With `set`, connects to another vault and records it in the config file. |
| `wiki_read` | Returns a note, by its path or its `[[link]]`, with its file on disk, since the vault lies outside the agent's working directory. |
| `wiki_changes` | Lists the change plans that wait for your approval, or the changes of any status. |

## What Changes in Your Vault

- **Nothing under `wiki/` changes without you.** `wiki_change` writes a change document under `internal/wiki/changes/` with `status: proposed`, and `wiki_ingest` starts a session that proposes one. You approve or reject it in Obsidian, in the change document or the Yami Wiki panel. The plugin has no tool that approves.
- **An ingest runs inside the server** on your own Claude Code or Codex, and you can watch its session in Obsidian. It lives as long as the agent session that started it; when that session ends first, resume the ingest in Obsidian.
- **The first call that connects to a vault enables the wiki module there**, as the Obsidian plugin does at load: it writes the module's documents under `internal/wiki/` when they are missing, or under the internal folder that the vault's `.yami.json` names. Keep this plugin and the Obsidian plugin on the same library version (this release uses yami 0.23.0), or each may rewrite an unedited module document to its own version's text.
- **Inside a vault, the agent may see the wiki tools twice** when a Duet or Yami Wiki conversation runs with this plugin on: the vault's own tools and this server's. Both work on the same vault. Turn the plugin off for that project if the duplicates bother you.

## Network Use and Privacy

The server makes no network connections. It reads and writes your vault's folder and its config file. For an ingest it starts Claude Code or Codex on your computer, which send what they read to Anthropic or OpenAI under your own sign-in.

## Development

```sh
npm install        # takes yami from the release tarball that package.json names
npm run build      # type-checks, then bundles the server into dist/server.mjs
npm test           # builds, then runs the unit tests, including the built server over stdio
```

`dist/server.mjs` is committed because a plugin install copies the repository and runs no build. CI fails when it differs from a fresh build. To try a checkout in a session, run `claude --plugin-dir /path/to/yami-wiki-agent-plugin`, or `codex plugin marketplace add /path/to/yami-wiki-agent-plugin`. [CLAUDE.md](CLAUDE.md) holds the conventions.

To release X.Y.Z, run `npm run set-version X.Y.Z` and `npm run build`, then commit and push to `main`. The release workflow tags the commit `X.Y.Z` when no release has that version yet.

## License

[MIT](LICENSE)
