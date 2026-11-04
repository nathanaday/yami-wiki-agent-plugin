---
name: context
description: Gather what the user's wiki knows that bears on a task outside the vault, such as work on a codebase, and write a brief with a citation on each claim. Use it at the start of a task in an ecosystem the wiki describes, or when the user asks what their notes say about the work at hand.
---
# Context for a task

The user keeps what they know in a wiki in their Obsidian vault. Before work in a project the wiki describes, read what it says, so the work follows the user's own decisions, names, and constraints.

1. **The subjects.** From the task and the project, list the names the wiki may hold: the systems, services, libraries, protocols, formats, people, decisions, and terms the task touches. The project's README and the names of its folders and files give most of them. Ten to twenty names is right.
2. **Where each stands.** Call `wiki_match` once with every name. A `hit` is a topic or source that holds the name or an alias; `near` names notes close to it; `new` means the wiki has no note on it.
3. **Search the task.** Call `wiki_search` with the task in one sentence as `text`, `limit` 10, and once more with `algorithm: "hop2"` to add the notes linked from the best hits. For a hit that matters, call `wiki_neighbors` with the note to see the tags around it, and `wiki_search` with `tags` for a tag that fits the task.
4. **Read.** Call `wiki_read` on the hits and the matches that bear on the task, at most about ten notes, and follow a `[[link]]` one hop when a note defers to another.
5. **The brief.** In your reply, short:
   - **What the wiki says.** The facts, decisions, and constraints that bear on the task, each with a `[[link]]` to its note and the note's vault path once, so the user can open it.
   - **Names and terms.** The wiki's names for the things the task touches, when they differ from the project's.
   - **Gaps.** What the task touches that the wiki does not cover. One line each.
   - **To read.** The two or three notes to open for more.
6. **Then work.** Keep the brief's facts in mind for the task. Write the brief to a file only when the user asks.

The wiki is the user's record, not yours: never write a file of the vault. When the task produces material the wiki should learn, such as a design note or a decision, offer `/yami-wiki:ingest` at the end, and let the user decide.
