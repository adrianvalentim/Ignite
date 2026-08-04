# Session Closing Protocol

Load this file only after the pedagogical phase is ready to close. Also load
`vault-contract.md` and `../schemas/session-log.md` before writing.

## 1. Audit the Evidence

For each concept actually tested, distinguish:

- Demonstrated: what the learner explained or applied accurately.
- Fragile: what was correct but depended on prompting or remained imprecise.
- Faded: what did not return during recall.
- Confused: what the learner could not yet organize coherently.
- Distorted: what returned confidently but incorrectly.
- Untested: what the session did not provide evidence about.

Do not score untested concepts. Do not infer mastery from fluency, agreement, or
the mere existence of an artifact.

## 2. Write the Session Log

Use `../schemas/session-log.md`. Record concrete evidence, honest outcomes when
understanding was tested, approximate duration when known, and the smallest
useful next actions. If the session ended early, say so and omit unsupported
scores.

## 3. Update Book State

Apply only changes justified by this phase and the transition rules in the
vault contract:

- Update the relevant stage when the phase was genuinely completed.
- Update concept and segment difficulty only when evidence changed the picture.
- Recompute the segment's session count when that field exists.
- Update Current State and Difficulties concisely so a future session can
  resume without reading the full history.
- Update the Book Map only when the structural understanding of the book has
  changed, not after every session.
- Add durable cross-book connections when they were actually established.

Recall must not change stage. Feynman work changes stage only if it was
explicitly part of another completed pipeline phase. Card drafts produce
`carded`; learner confirmation of editing and import produces `complete`.

## 4. Verify

Before closing:

- Re-read the current `book.md` and target directory immediately before writing.
  Reconcile changes made during the conversation instead of overwriting them.
- Never overwrite an existing log unless the learner explicitly asked to
  continue that exact session. Use the collision rule in the log schema.
- Confirm the log references the correct book and segment slugs.
- Confirm all scores lie between `0.0` and `1.0`.
- Confirm frontmatter remains valid and unrelated learner text is preserved.
- Confirm stable source and learner-owned artifacts were not changed.
- Confirm no private learning material is being added to a public repository.

Then tell the learner briefly what was recorded and what the next useful action
is. Do not discuss tracker implementation details unless asked.
