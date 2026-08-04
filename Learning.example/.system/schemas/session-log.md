# Session Log Schema

Use one Markdown file for each completed or meaningfully attempted session.

## Filename

Use `logs/{date}-{type}-{segment-slug}.md`. A final examination may use
`logs/{date}-examination-final.md`.

If that filename already exists, do not overwrite it unless this is explicitly
a continuation of the same session. Add a numeric sequence before `.md`, such as
`2026-08-04-recall-feedback-loops-2.md`.

## Frontmatter

```yaml
---
date: YYYY-MM-DD
book: book-slug
segment: segment-slug
type: interrogation | reconstruction-review | cards | feynman | recall | examination
duration_approx: 30m
outcomes:
  concept-slug: 0.7
---
```

Omit `segment` for genuinely book-wide work. Omit `duration_approx` when it is
unknown. Omit `outcomes` unless the session tested understanding. Card creation
alone usually does not justify outcomes.

Each outcome key names a concept actually tested. Its value records demonstrated
retrieval or understanding from `0.0` (absent or wholly incorrect) to `1.0`
(accurate, independent, and transferable). Partial, cued, fragile, and distorted
performance belongs between those endpoints according to the evidence.

## Body

```markdown
# Session Summary

A concise account of what happened.

## Demonstrated Understanding

- Specific ideas the learner explained or applied well.

## Difficulties

- Specific fragile, faded, confused, or distorted ideas.

## Next Actions

- Concrete follow-up work.
```

Record observed understanding rather than generic praise. Preserve uncertainty:
an incomplete session is valid evidence, but it is not evidence of completion.
