---
name: connect
description: Point the wiki tools at an Obsidian vault with Yami Wiki, or say which vault they work in now. Use it when the user names a vault, or when a wiki tool says that no vault is connected.
---
# Connect to a vault

The wiki tools work in one vault at a time. `wiki_vault` says which, and `wiki_vault` with `set` changes it.

1. With a path in the message, call `wiki_vault` with `set`: the path as given, also one that starts with `~`. The folder must be an Obsidian vault (it has `.obsidian/`) or a Yami vault (it has `internal/wiki/`); the tool refuses any other folder and says why. Do not create a folder, and do not pick another one yourself: ask.
2. With no path, call `wiki_vault` with nothing. When it reports a vault, tell the user the vault, its counts, and the change plans that wait. When it reports none, ask for the folder of the vault, in one line.
3. The result may carry a `warning`: the plugin's vault option names another vault, which wins at the next start. Pass it on in one sentence: in Claude Code, `/config` changes the option.

End with one line: the vault, and the counts.
