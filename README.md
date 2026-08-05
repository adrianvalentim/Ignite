# Effortful Learning System

Effortful Learning is a filesystem-first study system for turning books into
durable understanding through interrogation, reconstruction, cards, synthesis,
and review.

## Public and Private Data

This repository is designed to be shareable without publishing a personal
learning vault.

- `App/` contains the Tauri desktop tracker and its optional browser mode.
- `Learning.example/` contains a small synthetic demo workspace.
- `Learning/` is reserved for a real private vault and is ignored by git.
- `AGENTS.md` and `Learning.example/.system/prompts/` contain the AI operating
  instructions and session workflows.

For personal use, keep your private learning data in a separate private repo or
local folder. Start the desktop app and choose that vault on first launch:

```bash
pnpm -C App install:all
pnpm -C App desktop:dev
```

The browser/server mode remains available when it is useful for development:

```bash
LEARNING_WORKSPACE="/path/to/private/Learning" pnpm -C App dev
```

If `LEARNING_WORKSPACE` is not set, the backend looks for `Learning/` first and
then falls back to `Learning.example/`.

## One App, Separate Vault

Maintain application improvements in this public repository. A private
learning repository should contain the real vault, not another maintained copy
of `App/`.

Run the browser/server mode against a private vault with:

```bash
cd /path/to/effortful-learning-system
LEARNING_WORKSPACE="/path/to/private-repo/Learning" pnpm -C App dev
```

The app reads the external vault directly. Changes made by a learning agent are
reflected in an open desktop window automatically. Application-code changes
appear immediately in `desktop:dev`; packaged copies must be rebuilt until a
signed update channel is added.

## Demo Data

The example workspace uses synthetic books, notes, logs, and card drafts. It is
meant to show the file format and give the app something safe to render in a
fresh public clone.

Do not commit real study logs, PDFs, scraped source text, clippings, Obsidian
state, or personal notes to the public repo.

## AI Workflow

AI agents use progressive disclosure. They read `AGENTS.md`, the active
workspace's compact context and session router, and then only the prompt and
evidence required for the current learning phase. Closing formats and vault
write rules are loaded after the learning conversation, not while the agent is
choosing questions.

In a fresh public clone, those instructions live under
`Learning.example/.system/`; in a real local setup, they usually live under the
private `Learning/.system/` vault. During a learning session, agents should not
inspect `App/`: the tracker is only a read-only consumer of valid vault files.

To preview the files needed for a session without loading their contents into
the agent's working context:

```bash
node scripts/learning-context.mjs \
  --workspace Learning.example \
  --book clear-thinking-primer \
  --segment claims-and-reasons \
  --mode interrogation
```

For an external vault that has not yet copied the router and protocols, the
planner automatically uses its workspace-specific `CONTEXT.md` together with
the generic instruction bundle in `Learning.example/.system`. An explicit
bundle can be selected with `--instructions /path/to/.system`.
