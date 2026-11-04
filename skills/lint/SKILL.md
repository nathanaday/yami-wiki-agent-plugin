---
name: lint
description: Check the health of the wiki or of some notes: dead links, duplicate names, missing descriptions, uncited sources, and orphan topics, each with its fix. Use it when the user asks whether the wiki is in order, or before proposing a change.
---
# Lint the wiki

Lint is code: `wiki_lint` reports the findings, each with its fix. You read them for the user.

1. **Scope.** Call `wiki_lint` with nothing for the whole vault, with `folder` for `wiki/topics` or `wiki/sources`, or with `paths` for the notes the user named.
2. **Report.** Errors first (`bad-properties`, `dead-link`, `no-description`), then warnings (`duplicate-name`, `no-sources`, `uncited`, `orphan`). Group by kind, one line per note with its fix. Nothing found is one line.
3. **Fixes.** Do not write fixes into the vault. When the user asks you to fix findings in `wiki/topics/` or `wiki/sources/`, read each note with `wiki_read`, and propose every fix as one change with `wiki_change`: a `modify` for each note with the properties that change and the whole new body when it changes, and a `why` each. Tell the user the change waits for their approval in Obsidian. A finding on a note outside the wiki's folders is for the user to fix by hand.
