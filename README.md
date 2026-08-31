# Ignite: An Effortful Learning System

> The mind is not a vessel to be filled, but a fire to be kindled.
>
> — Plutarch

## Philosophy and purpose

Reading can create a convincing feeling of understanding while leaving little
that can be explained, applied, or recalled later. Ignite is built around a
different premise: durable learning comes from generating understanding, not
merely receiving information.

That means attempting an answer before seeing one, reconstructing an argument
from memory, explaining why it works, testing its limits, connecting it to
other ideas, and returning after enough time has passed for recall to become
genuinely effortful.

The effort is not punishment, and difficulty is not a goal in itself. The aim
is useful struggle: enough resistance to reveal what is absent, fragile,
confused, or distorted, followed by the right question or piece of feedback.
Ignite treats those distinctions as evidence about learning rather than as
scores of intelligence or motivation.

AI has a deliberately constrained role in this process. It should not replace
the learner's thinking with polished summaries or expose the answer too early.
It should ask, listen, diagnose, challenge, and adapt—then help compare the
learner's fixed reconstruction with the source. The learner remains the author
of the understanding.

Ignite exists to make this practice sustainable across whole books. It keeps
the learning process visible, remembers where each idea stands, schedules
return without turning study into a streak game, and preserves the learner's
work as ordinary local files.

## How Ignite works

Each book is divided into conceptual segments. A segment moves through a
deliberate learning pipeline:

1. **Read independently.** Encounter the source before receiving an AI
   explanation.
2. **Interrogate.** Answer adaptive questions about mechanisms, examples,
   boundaries, implications, and transfer.
3. **Reconstruct.** Write the idea or argument from memory in your own words.
4. **Review the reconstruction.** Fix the learner's version first, then compare
   it with the source to find omissions and distortions.
5. **Make and edit cards.** Turn the most valuable distinctions into prompts
   for later retrieval.
6. **Return for delayed recall.** Recall begins without the source. The app
   derives when a segment is due from prior sessions, difficulty, and recorded
   outcomes.

Targeted Feynman explanations can be used when an idea remains unclear, and a
final examination can test synthesis across a completed book. Completion is
not terminal: memory fades, so finished segments continue to return for
retrieval.

### The app and the learning vault

Ignite has two intentionally separate parts:

- The **learning vault** is the source of truth: readable Markdown files for
  books, source material, reconstructions, cards, session logs, and cross-book
  connections.
- The **Ignite app** is a read-only view over that vault. It shows what needs
  attention, where each book stands, what has been learned, and when recall is
  due. It also provides a local Codex interface for guided learning sessions.

There is no application database and no proprietary storage format. The app
watches the selected vault and refreshes when its files change. The tracker
itself cannot edit learning content; changes remain behind the learning agent's
normal sandbox and approval flow.

The interface includes:

- **The Desk** for reviews, next pipeline moves, and weekly effort.
- **Library** and **Board** for books and their current states.
- **Chronicle** for the full learning-session history.
- **Ledger** for effort, retention, stages, and recurring difficulty.
- **Codex** for local, subscription-backed learning conversations.

### Phase-specific AI guidance

Ignite gives an AI agent only the instructions and evidence required for the
current phase. Recall keeps the source out of context until unaided retrieval
and follow-up questions are complete. Reconstruction review waits until the
learner's reconstruction is fixed. Closing formats and persistence rules are
loaded only when the teaching conversation ends.

This progressive disclosure helps the agent protect source timing, avoid
answer leakage, and respond to evidence from the learner's latest attempt.

### Local-first privacy and ownership

The public app and the private learning vault are separate by design. Keep real
study material in a private repository or local folder and point Ignite to it.
The public repository contains only the application, operating instructions,
and a synthetic example workspace.

File ownership is explicit:

- Learners own reconstructions, theses, and essays.
- Source material remains stable after setup.
- AI-assisted sessions may maintain logs, cards, compact book state, and
  cross-book connections.

Do not commit real study logs, copyrighted source text, PDFs, clippings,
personal notes, or Obsidian state to this public repository.

## Run Ignite

Install Node.js, pnpm, and Rust, then run the desktop app from the repository
root:

```bash
pnpm -C App install:all
pnpm -C App desktop:dev
```

On first launch, choose the private `Learning` folder that contains `books/`.
The selection is remembered across launches.

The browser/server mode is also available:

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
