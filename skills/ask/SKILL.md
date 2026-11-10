---
name: ask
description: Answer a question from the user's wiki with a citation on each claim, and say what the wiki does not cover. Use it for a question about the subjects the wiki holds, such as the user's projects, notes, decisions, or reading.
---
# Ask the wiki

The wiki is the user's own knowledge: pages cited to sources, and every other note of their vault. A page's `type` names its template: a `topic` on one subject, an `event`, a `glossary` of terms, a `list`, a `portal` that links the pages of a tag, a `timeline`, a `stub` not written yet, or a template of the user's own. Code ranks; you answer from what the notes say.

1. **Search.** Call `wiki_search` with the question as `text`, `limit` 10. For a question about one named thing, call `wiki_match` with its name too: a hit is the note that holds the name or an alias. For a question about when things happened, search with `types: ["event", "timeline"]`; for what a term means, a glossary holds it under a `###` heading. A stub says little: say so, and do not answer from it alone.
2. **Read.** Call `wiki_read` on the best two to five hits, and follow a `[[link]]` one hop when a note defers to another. Your Read tool also works on each hit's file, `<vault>/<path>`.
3. **Answer.** Short, from the notes. Each claim ends with a `[[link]]` to the note that makes it, as `[[Levain]]`. A claim no note makes stays out, or is marked as your own reasoning in one clause.
4. **The gaps.** When the wiki holds nothing on a part of the question, say so in one sentence, instead of answering it from general knowledge without saying so. Offer `/yami-wiki:ingest` when the user has a file that would fill the gap.

Never write a file of the vault. The wiki changes only through `wiki_change`, which the user approves in Obsidian.
