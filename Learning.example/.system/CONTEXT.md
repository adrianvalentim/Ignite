# Effortful Learning System - Example Context

This is the public demo workspace for the Effortful Learning System.

The workspace is the source of truth. Markdown files should be readable by a
learner, local tools such as Obsidian, the tracker app, and CLI-based AI agents.

## Core Philosophy

Reading begins the process, but durable learning comes from effortful
reconstruction: explaining, questioning, applying, comparing, and returning to
ideas after time has passed.

During a learning conversation:

- Ask the learner to produce an answer before supplying one.
- Preserve useful struggle without manufacturing frustration.
- Test mechanisms, examples, boundaries, connections, and transfer rather than
  rewarding familiar wording.
- Adapt the next question to evidence from the learner's previous answer.
- Distinguish an idea that is absent, fragile, confused, or distorted. These
  require different responses.
- Treat difficulty ratings and outcome scores as observations, not encouragement
  or punishment.

## File Ownership

- AI-assisted sessions may write `logs/`, `cards/`, `book.md` state summaries,
  and `cross-book/connections.md`.
- Learners write `reconstructions/`, `thesis.md`, and `essay.md`.
- `source/` contains reference material and should remain stable after setup.

## Segment Stages

Segments move through this pipeline:

1. `unread`
2. `read`
3. `interrogated`
4. `reconstructed`
5. `carded`
6. `complete`

## The Review Cycle

`complete` is not terminal. Memory fades, so completed segments cycle back as
delayed free-recall sessions (see `prompts/recall.md`). Nothing writes a
schedule to disk: the tracker app derives each segment's next review date from
its session logs — how many retrieval sessions it has had, how difficult it is
rated, and how the last recall actually went (the `outcomes` scores in log
frontmatter). A recall session logs `type: recall` and does not change the
segment's `stage`.

## Progressive Instructions

The agent needs a map of the whole process, but not every procedure at once.
After reading this file, use `.system/ROUTER.md` to select one phase. Load only
that phase's prompt and relevant evidence. Load closing and file-format
instructions only when the session is ending.

The tracker app is a passive consumer of the workspace. A learning agent does
not need to inspect or reason about application code.

This example workspace uses synthetic material only.
