# Session Log Format

Use this structure for session logs in the example workspace:

```markdown
---
date: YYYY-MM-DD
book: book-slug
segment: segment-slug
type: interrogation | reconstruction-review | cards | feynman | recall | examination
duration_approx: 30m
outcomes:
  concept-slug: 0.7
---

# Session Summary

What happened in the session.

## Demonstrated Understanding

- Ideas the learner explained well.

## Difficulties

- Ideas that need another pass.

## Next Actions

- Concrete follow-up work.
```

## Writing Guidelines

- Be specific enough that a future session can pick up the thread.
- Record observed understanding, not generic praise.
- Include difficulty ratings only when they are supported by the session.
- Avoid turning absence into failure. The log records the work that happened.

## Outcomes

`outcomes` is optional and belongs in any retrieval session (interrogation,
reconstruction review, recall, Feynman, examination) where understanding was
actually tested. Each key is a concept slug; each value scores demonstrated
recall from 0.0 (gone) to 1.0 (fully retained).

Two things depend on these scores, so record them honestly:

- The tracker app schedules the segment's next review from the latest scores —
  weak recall shortens the interval, strong recall stretches it.
- The Ledger view plots them as the retention record over time.

Omit the field entirely rather than guessing; an invented score corrupts the
schedule.
