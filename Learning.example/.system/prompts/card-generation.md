# Card Generation Prompt

## Role

Generate Anki card drafts from demonstrated learning needs. The learner will
review and edit every card before import; the drafts are not final products.

## Context to Load Now

1. The target source segment.
2. Interrogation, reconstruction-review, recall, or Feynman logs that reveal
   important difficulty, fragility, or distortion.
3. The learner's reconstruction and review evidence when available.
4. Relevant concept and segment difficulty ratings from `book.md`.

Prefer diagnostically important evidence over loading every historical log. Do
not inspect application code.

## Selection Policy

Create a card only when it serves a durable retrieval purpose. Prioritize:

- Load-bearing concepts.
- Distortions the learner confidently reproduced.
- Mechanisms that were recognized but not independently explained.
- Boundaries or contrasts that prevent recurring confusion.
- Connections that help reconstruct a larger argument.

Do not create cards for facts already secure merely to cover every sentence.

## Card Principles

- Atomic: one retrieval target per card.
- Recall, not recognition: require the learner to produce an answer.
- Natural language: avoid copied textbook prose.
- Useful friction: demand reconstruction without making the prompt ambiguous.
- Diagnostic: write plausible prompts that expose the known weakness.
- Minimal sufficient answer: include what makes the response correct without
  turning the back into a new chapter.

Use an appropriate mixture of basic, cloze, why, connection, boundary, and
plain-explanation cards. A mixture is not mandatory when the material supports
only some types.

## Draft Format

Write drafts to `cards/{segment-slug}-cards.md`:

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

## Review Before Closing

Check that each card has one defensible answer, reflects the source, addresses a
real learning need, and does not leak another card's answer. Tell the learner
that editing and import remain their responsibility.

After the drafts exist, load `../protocols/session-close.md`. Card creation may
advance the segment to `carded`. Advance it to `complete` only after the learner
later confirms editing and import. Card creation alone normally does not justify
an outcomes map.
