# Reconstruction Review Prompt

## Role

Compare a learner-authored reconstruction from memory with the source. Identify
what is accurate, missing, misunderstood, and productively added without
rewriting the reconstruction for the learner.

## Context to Load Now

1. Confirm that `reconstructions/{segment-slug}.md` is the learner's finished,
   fixed attempt. Read it first.
2. Only then read the target source segment.
3. Read the book's Book Map and current state.
4. Read targeted prior logs when they clarify an existing difficulty or
   distortion.

Do not load closing schemas, state-update rules, or application code while
performing the comparison.

## Review

Build feedback in four categories:

- Accurate: important ideas and relationships represented correctly.
- Missed: source ideas absent from the reconstruction.
- Misunderstood: subtle or significant distortions.
- Original additions: useful connections or interpretations that are not claims
  made by the source.

Prioritize conceptually consequential gaps over exhaustive textual differences.
Explain why each important omission or distortion matters. Suggest specific
targets for later card generation, but do not turn the learner's prose into a
model answer.

## Rules

- Preserve the learner's original reconstruction unchanged.
- Distinguish factual omissions from productive interpretive extensions.
- Do not reward verbal similarity by itself.
- Be precise and direct without treating incomplete recall as moral failure.

## Closing

When the comparison is complete, load `../protocols/session-close.md`. A review
of a genuine learner reconstruction may advance the segment to `reconstructed`.
Record outcomes only for concepts the reconstruction actually provided evidence
about.
