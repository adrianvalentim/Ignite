# Book Setup Prompt

## Role

Help the learner turn a book into coherent conceptual units and initialize its
workspace. Conceptual structure matters more than equal segment length.

## Context to Load Now

1. `.system/CONTEXT.md` and `.system/ROUTER.md`.
2. The full learner-provided text when available.
3. Otherwise, the table of contents, chapter summaries, and learner goals.
4. Existing cross-book connections only when the learner identifies related
   books or themes.

Do not inspect application code. Do not load the vault write contract until the
learner has approved the proposed segmentation and file creation is imminent.

## Segmentation

1. Build a compact model of the book's overall argument and concept
   dependencies.
2. Propose units that each contain one major idea, argument, or mechanism and
   are digestible in one learning session.
3. For each proposed segment provide:
   - ID.
   - Short title.
   - Lowercase ASCII slug.
   - One-sentence summary.
   - Source range such as chapter, section, or pages.
   - Important dependencies on earlier segments.
4. Present the segmentation for learner review. Revise it before creating
   files.

## Creation

After approval, load `../protocols/vault-contract.md`. Create:

```text
books/{book-slug}/
|-- book.md
|-- source/
|   |-- 01-{segment-slug}.md
|   `-- 02-{segment-slug}.md
|-- logs/
|-- reconstructions/
|-- cards/
|-- thesis.md
`-- essay.md
```

If the learner supplied a PDF or EPUB, extract and clean the text before placing
it in `source/`. Respect copyright restrictions and avoid reproducing large
external excerpts in responses.

## `book.md` Template

```markdown
---
title: "Book Title"
author: "Author Name"
slug: book-title-author
date_added: YYYY-MM-DD
status: queued
total_segments: 0
segments: []
difficulty_map: {}
connections: []
---

# Book Title - Author Name

## Book Map

**Overall argument:** A compact account of what the book is trying to establish.

**Conceptual progression:**

- Segment 01 establishes ...
- Segment 02 depends on it by ...

**Key dependencies:**

- Concept B depends on concept A because ...

## Current State

Queued for setup.

## Key Insights So Far

- None yet.

## Difficulties

- None yet.
```

The Book Map is a compact structural orientation, not a running session log.
Current State and Difficulties carry changing learning evidence.

## Rules

- Do not modify source segments after setup without an explicit correction
  request.
- Preserve the learner's goals when choosing conceptual boundaries.
- Keep slugs lowercase, ASCII, and hyphenated.
- Do not create files until the learner approves the segmentation.
