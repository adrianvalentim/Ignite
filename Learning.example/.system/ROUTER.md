# Learning Session Router

Use this map after `CONTEXT.md`. It provides whole-process awareness without
loading every procedure.

## Start

1. Identify the learner's intent, book, and segment.
2. Read `book.md`, especially the Book Map, Current State, difficulties, and
   target segment. In a legacy book without a Book Map, use its segment list,
   Key Insights, and Current State instead.
3. Choose one primary mode below. Explicit learner intent overrides the default
   suggested by stage.
4. Read only that mode's prompt and the evidence it names.
5. Prefer recent and diagnostically important logs. Expand to older logs,
   previous source segments, or cross-book notes only when the next decision
   requires them.
6. Keep closing protocols out of the teaching context until the session ends.
7. Do not inspect `App/`. Valid vault files are the entire interface to the
   read-only tracker.

Treat stages as routing hints, not proof that an artifact exists. If stage,
logs, cards, or reconstructions disagree, inspect the smallest relevant set,
preserve the evidence, and repair state only during a justified closing step.

## Process Map

- `unread` -> **independent reading**. The learner reads without AI
  pre-explanation. After learner confirmation, the segment may become `read`.
- `read` -> **interrogation**. Load `prompts/interrogation.md` and the evidence
  it requests.
- `interrogated` -> **learner reconstruction**. The learner writes from memory;
  do not expose or rewrite from the source.
- Fixed learner reconstruction -> **reconstruction review**. Load
  `prompts/reconstruction-review.md`; read the reconstruction before the source.
- `reconstructed` -> **card generation**. Load
  `prompts/card-generation.md`.
- `carded` -> **learner editing and import**. Mark `complete` only after learner
  confirmation.
- Review due -> **delayed free recall**. Load `prompts/recall.md` and prior
  evidence, but keep the source unopened until unaided recall and cued follow-ups
  are finished. Recall never changes stage.
- Targeted clarity problem -> **Feynman explanation**. Load
  `prompts/feynman.md`.
- All segments complete -> **final examination**. Load
  `prompts/examination.md`; inventory the whole history but read full logs and
  source passages selectively.
- Uninitialized book -> **book setup**. Load `prompts/setup-book.md`; create
  files only after the learner approves segmentation.

A chapter may contain several conceptual segments. Keep one primary segment per
session; load adjacent segments only when they are needed to understand the
chapter's structure or a dependency.

## Context Rules

The phase prompt determines what is needed now. The Book Map supplies compact
structural context; Current State and targeted logs supply changing learner
evidence. Find additional material on demand instead of reading directories in
advance.

For a long source, maintain a compact internal outline with source locations and
reopen exact passages when precision is needed. The outline supports navigation;
it never replaces the source as evidence.

Source timing is a hard boundary. Interrogation, Feynman work, and card
generation may load the target source before acting. Recall may not. A learner
reconstruction must be fixed before the review agent compares it with source.

If the learner explicitly changes activities mid-session, suspend or close the
current mode before loading the new phase prompt. Do not preload possible future
phases merely because a pivot might occur.

## Close

Close when the learner stops, the phase has enough evidence, or further probing
would add little. Only then read `protocols/session-close.md` and its referenced
contract and schema. Preserve uncertainty after an incomplete session; never
invent scores or completion.

Book setup and simple learner confirmations may use
`protocols/vault-contract.md` directly when no diagnostic session log is needed.
