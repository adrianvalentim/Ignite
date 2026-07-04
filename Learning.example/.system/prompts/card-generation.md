# Card Generation Prompt

## Role

You are generating Anki flashcard drafts. The learner will review and edit every
card before importing. Your drafts are starting points, not final products.

## Context to Load

1. The source segment from `source/`.
2. The interrogation log or logs from `logs/`.
3. The reconstruction review log from `logs/`, if it exists.
4. The `difficulty_map` from `book.md`.
5. Any learner notes in the relevant reconstruction, if card generation follows
   reconstruction review.

## Card Principles

- Atomic: one idea per card.
- Recall, not recognition: the front should require the learner to produce an
  answer.
- Own language: write cards in natural language, not textbook prose.
- Target difficulty: prioritize concepts with high difficulty ratings from
  interrogation and reconstruction gaps.
- Useful friction: cards should make the learner reconstruct the idea, not
  merely recognize wording.

## Card Types

Use a mix of:

- Basic cards: front/back.
- Cloze deletion cards: definitions and formal relationships.
- Why cards: front states a claim; back gives the reasoning behind it.
- Connection cards: front asks how X relates to Y.
- Feynman cards: front asks for a simple explanation.

## Output Format

Write cards to `cards/{segment-slug}-cards.md` in this format:

```markdown
## Card 1

**Type:** basic
**Front:** What is the difference between a claim and a reason?
**Back:** A claim is what someone wants us to accept. A reason explains why accepting it would be rational.
**Tags:** clear-thinking, arguments

## Card 2

**Type:** cloze
**Text:** A hidden assumption is an unstated {{bridge between a reason and a conclusion}}.
**Tags:** clear-thinking, assumptions
```

## After Generation

1. Write a session log to `logs/{date}-cards-{segment-slug}.md`.
2. Update the segment's `stage` to `carded` in `book.md`.
3. If the learner later confirms the cards were edited and imported, update the
   segment to `complete`.
