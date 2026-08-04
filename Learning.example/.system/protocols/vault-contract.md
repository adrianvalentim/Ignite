# Vault Write Contract

Load this protocol only when a phase is about to create or update learning
artifacts. The tracker passively reads these files; application code is not part
of the learning-session context.

## Source of Truth

- `books/{book-slug}/book.md` records book and segment state.
- `source/` is stable reference material. Do not modify it after setup unless
  the learner explicitly requests a correction.
- `logs/` records observed session evidence.
- `cards/` contains AI drafts that the learner reviews and edits.
- `reconstructions/`, `thesis.md`, and `essay.md` belong to the learner. Do not
  write or rewrite them.
- `cross-book/connections.md` records durable connections between books.

Preserve unrelated learner content and formatting when making localized state
updates.

## Canonical Values

- Book statuses: `queued`, `active`, `completed`.
- Segment stages: `unread`, `read`, `interrogated`, `reconstructed`, `carded`,
  `complete`.
- Dates: local calendar dates in `YYYY-MM-DD` form.
- Slugs: lowercase ASCII words separated by hyphens.
- A log's `book` value should match the book directory and `book.md` slug.
- A log's `segment` value should use the segment slug.
- Difficulties and outcomes are numbers from `0.0` to `1.0`.
- Reuse established concept slugs in `difficulty_map` and prior outcomes. Do not
  create synonyms for the same concept merely because the wording changed.

## Meaning of Measurements

`difficulty_map` is concept-level friction. A segment's `difficulty` is a
holistic estimate for scheduling. Update either only when the session produced
evidence. Difficulty is not the inverse of an outcome, and neither value should
be used as praise or punishment.

`outcomes` records demonstrated retrieval or understanding for concepts that
were actually tested. Omit untested concepts and omit the entire field rather
than guessing.

## Derived Consistency Fields

When updating `book.md`:

- Keep `total_segments` equal to the number of segment entries.
- If a segment has a `sessions` field, recompute it from matching session logs
  rather than incrementing it blindly.
- Keep frontmatter state and the prose Current State consistent.
- Keep the Book Map structural and compact; put changing session details in
  Current State, Difficulties, and logs.

## Transition Rules

- Independent reading may move `unread` to `read` after learner confirmation.
- A completed interrogation may move `read` to `interrogated`.
- Reviewing a learner-authored reconstruction may move the segment to
  `reconstructed`.
- Creating card drafts may move it to `carded`.
- Move `carded` to `complete` only after the learner confirms editing and
  import.
- Recall and Feynman sessions do not automatically change stage.
- Mark a book `completed` only after a final examination demonstrates
  book-level synthesis.

Do not move a stage backward merely because recall was weak. Record the evidence
and let the review cycle respond.
