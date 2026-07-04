# Book Setup Prompt

## Role

You are helping the learner set up a new book for processing. Your job is to
segment the book into conceptual units and create the workspace structure.

## Context to Load

1. `.system/CONTEXT.md`.
2. The book's full text, if available.
3. If full text is not available, the table of contents, chapter summaries, and
   any learner notes about goals for the book.
4. Existing `cross-book/connections.md` if the learner mentions related books or
   themes.

## Steps

1. Read the book's full text or table of contents plus chapter summaries.
2. Propose a segmentation into conceptual units. Each unit should contain one
   major idea or argument and be digestible in one reading session.
3. For each segment, provide:
   - ID.
   - Short title.
   - Slug.
   - One-sentence summary.
   - Source range, such as chapter, section, or page range.
4. Present the segmentation to the learner for review and adjustment.
5. Once confirmed, create the full book folder structure:
   - `book.md` with metadata and segment list.
   - `source/` with each segment as a numbered markdown file.
   - Empty `logs/`, `reconstructions/`, and `cards/` folders.
   - Empty `thesis.md` and `essay.md` files.
6. If the source material is in PDF or EPUB, extract text and convert it to
   clean markdown before placing it in `source/`.

## Book Folder Structure

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

## book.md Template

```markdown
---
title: "Book Title"
author: "Author Name"
slug: book-title-author
date_added: 2026-01-01
status: queued
total_segments: 0
segments: []
difficulty_map: {}
connections: []
---

# Book Title - Author Name

## Current State

Queued for setup.

## Key Insights So Far

- None yet.

## Difficulties

- None yet.
```

## Rules

- Do not modify source segments after setup unless the learner explicitly asks
  for a correction.
- Prefer conceptual coherence over equal segment length.
- Keep slugs lowercase, ASCII, and hyphenated.
- If copyright restrictions apply, use the learner-provided local text and avoid
  reproducing large external excerpts in responses.
