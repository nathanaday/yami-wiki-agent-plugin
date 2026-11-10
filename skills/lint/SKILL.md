---
name: lint
description: Check the health of the wiki or of some notes: dead links, duplicate names, missing descriptions, pages that their template does not fit, stubs to write, uncited sources, and orphan pages, each with its fix. Use it when the user asks whether the wiki is in order, or before proposing a change.
---
# Lint the wiki

Lint is code: `wiki_lint` reports the findings, each with its fix. You read them for the user.

1. **Scope.** Call `wiki_lint` with nothing for the whole vault, with `folder` for `wiki/pages` or `wiki/sources`, or with `paths` for the notes the user named.
2. **Report.** Errors first (`bad-properties`, `dead-link`, `no-description`), then warnings (`duplicate-name`, `unknown-template`, `bad-property`, `missing-section`, `no-sources`, `uncited`, `orphan`, and the template checks `chronological` and `coverage`), then info (`stub`, `kind-retired`) as a to-do list. Group by kind, one line per note with its fix. Nothing found is one line. A finding on a page's template names the template's `TEMPLATE.md`: `wiki_templates` lists the templates, with the problems of the ones that do not read.
3. **Fixes.** Do not write fixes into the vault. When the user asks you to fix findings in `wiki/pages/` or `wiki/sources/`, read each note with `wiki_read`, and read the template of each page you change (its `path` in `wiki_templates`), and propose every fix as one change with `wiki_change`: a `modify` for each note with the properties that change and the whole new body when it changes, and a `why` each. Tell the user the change waits for their approval in Obsidian. A stub becomes a page with a `modify` that sets `type` to its template, adds the template's properties, and writes its sections. A finding on a note outside the wiki's folders, or on a template, is for the user to fix by hand.
