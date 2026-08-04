# Effortful Learning System

Effortful Learning is a filesystem-first study system for turning books into
durable understanding through interrogation, reconstruction, cards, synthesis,
and review.

## Public and Private Data

This repository is designed to be shareable without publishing a personal
learning vault.

- `App/` contains the local tracker app.
- `Learning.example/` contains a small synthetic demo workspace.
- `Learning/` is reserved for a real private vault and is ignored by git.
- `AGENTS.md` and `Learning.example/.system/prompts/` contain the AI operating
  instructions and session workflows.

For personal use, keep your private learning data in a separate private repo or
local folder, then point the app at it:

```bash
LEARNING_WORKSPACE="/path/to/private/Learning" pnpm -C App dev
```

If `LEARNING_WORKSPACE` is not set, the backend looks for `Learning/` first and
then falls back to `Learning.example/`.

## One App, Separate Vault

Maintain application improvements in this public repository. A private
learning repository should contain the real vault, not another maintained copy
of `App/`.

Run this checkout against a private vault with:

```bash
cd /path/to/effortful-learning-system
LEARNING_WORKSPACE="/path/to/private-repo/Learning" pnpm -C App dev
```

The app reads the external vault directly, so a local app improvement applies
to personal use immediately. Other users receive it after the public change is
committed, pushed, and pulled into their checkout.

## Demo Data

The example workspace uses synthetic books, notes, logs, and card drafts. It is
meant to show the file format and give the app something safe to render in a
fresh public clone.

Do not commit real study logs, PDFs, scraped source text, clippings, Obsidian
state, or personal notes to the public repo.

## AI Workflow

AI agents should read `AGENTS.md`, then the relevant workspace context and prompt
template before changing learning files. In a fresh public clone, those live
under `Learning.example/.system/`; in a real local setup, they usually live under
the private `Learning/.system/` vault.
