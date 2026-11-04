---
name: ingest
description: Teach the wiki a file or a folder from outside the vault, such as a project's docs, a paper, a deck, or a note you wrote. Use it when the user asks the wiki to learn, absorb, or ingest something.
---
# Ingest into the wiki

An ingest reads sources and proposes cited topics as one change plan, which the user approves in Obsidian. It runs as a session of the wiki, on the user's own Claude Code or Codex, inside this server. You hand the files over and end; you do not read or summarize them yourself.

1. **The files.** Take the paths from the message, as absolute paths. A relative path is relative to your working directory: resolve it. One folder is also fine: every file in it and its subfolders goes in, hidden files left out. A `.pptx` or a `.docx` is captured with its text. Do not ingest a whole repository or a `node_modules`: ask for the folder of docs, or the files, when the request is that broad.
2. **Call `wiki_ingest`** once, with `files` or `folder`, and a `name` when the user gave one. It captures each file as a source, creates the ingest session, starts its run, and returns at once with the session's path and its sources. A file it cannot read refuses the whole call: fix the path and call again.
3. **Report.** One or two lines: the session's path, the number of sources, and that the run proposes a change plan that waits for approval in Obsidian (the Yami Wiki panel, or the change document). Do not wait for the run, and do not poll. The run goes on while this session lives; when it stops early, the user resumes the session in Obsidian.
4. **Later.** When the user asks whether it went through, call `wiki_changes`: a proposed change of the session is the plan to approve; none yet means the run still works, or stopped.

Never write a file of the vault yourself, and never propose topics for these files with `wiki_change`: the ingest does, with its sources cited.
