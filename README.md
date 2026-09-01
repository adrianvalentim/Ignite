# Ignite: An Effortful Learning System

> The mind is not a vessel to be filled, but a fire to be kindled.
>
> — Plutarch

## Purpose

Reading often produces familiarity without recall or understanding. Ignite is
a system for studying whole books through questions, explanation,
reconstruction, and delayed recall.

The learner answers before seeing the answer, reconstructs arguments from
memory, tests their limits, and returns to them after time has passed. Difficulty
shows whether an idea is missing, weak, confused, or mistaken. Feedback should
address that specific problem.

AI asks questions and evaluates answers. It does not write the learner's
reconstruction or read source material before the current phase permits it.

Ignite records progress, schedules recall, and keeps the learner's work in
local files.

## How Ignite works

Each book is divided into conceptual segments. Each segment follows the same
sequence:

1. **Read.** Meet the source before receiving an AI explanation.
2. **Interrogate.** Answer questions about causes, examples, limits,
   implications, and applications.
3. **Reconstruct.** Write the argument from memory in your own words.
4. **Review.** Save the reconstruction, then compare it with the source to find
   omissions and errors.
5. **Make cards.** Turn the important distinctions into retrieval prompts and
   edit them yourself.
6. **Recall later.** Begin without the source. Ignite calculates the next
   review date from earlier sessions, difficulty, and outcomes.

Feynman explanations address ideas that remain unclear. A final examination
tests synthesis across the book. Completed segments still return for recall.

### App and vault

Ignite separates the learning files from the app:

- The **learning vault** holds books, sources, reconstructions, cards, session
  logs, and cross-book connections as readable Markdown.
- The **app** reads the vault and shows current work, book progress, session
  history, and reviews. It also includes a local Codex interface for learning
  sessions.

The app has no database and cannot write to the vault. It watches the selected
folder and refreshes when files change. Codex runs separately, under its normal
sandbox and approval rules.

The interface includes:

- **The Desk** for reviews, next pipeline moves, and weekly effort.
- **Library** and **Board** for books and their current states.
- **Chronicle** for the full learning-session history.
- **Ledger** for effort, retention, stages, and recurring difficulty.
- **Codex** for local, subscription-backed learning conversations.

### AI instructions

The agent loads one phase at a time, with only the evidence needed for that
phase. During recall, it does not read the source until unaided recall and
follow-up questions are finished. During reconstruction review, it reads the
learner's saved version before the source. It loads file-writing rules only
when the session ends.

### Privacy and ownership

Keep real study material in a private repository or local folder. The public
repository contains the app, its instructions, and a synthetic example vault.

Ownership is explicit:

- Learners own reconstructions, theses, and essays.
- Source material remains stable after setup.
- AI-assisted sessions may maintain logs, cards, compact book state, and
  cross-book connections.

Do not commit study logs, copyrighted source text, PDFs, clippings, personal
notes, or Obsidian state to this public repository.

## Run Ignite

Install Node.js, pnpm, and Rust, then run the desktop app from the repository
root:

```bash
pnpm -C App install:all
pnpm -C App desktop:dev
```

On first launch, choose the private `Learning` folder that contains `books/`.
The selection is remembered across launches.

To run in a browser:

```bash
LEARNING_WORKSPACE="/path/to/private/Learning" pnpm -C App dev
```

If `LEARNING_WORKSPACE` is not set, the backend looks for `Learning/`, then
falls back to the public `Learning.example/` workspace.

For native build, distribution, architecture, and Codex setup details, see the
[app documentation](App/README.md).

## Repository map

- `App/` — Tauri desktop app and optional browser/server mode.
- `Learning.example/` — synthetic demo vault and public learning protocols.
- `Learning/` — reserved for a private local vault and ignored by Git.
- `AGENTS.md` — routing rules for application work and learning sessions.
- `scripts/learning-context.mjs` — previews the minimal evidence a learning
  phase would load.

To inspect a public example session plan without loading its contents:

```bash
node scripts/learning-context.mjs \
  --workspace Learning.example \
  --book clear-thinking-primer \
  --segment claims-and-reasons \
  --mode interrogation
```

## Validation

```bash
pnpm -C App check
```

The check runs the backend tests against the synthetic workspace, builds the
frontend, and validates the Tauri permission manifest and native shell.
