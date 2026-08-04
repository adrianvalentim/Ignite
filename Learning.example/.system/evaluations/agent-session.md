# Agent Session Evaluation

Use these scenarios when changing the learning instructions. The objective is
not merely shorter prompts; it is better pedagogical judgment with less
irrelevant context.

## Measures

Record:

- Files and approximate words loaded before the first pedagogical question.
- Time or turns before the first useful question.
- Whether the agent inspected `App/` during an ordinary learning session.
- Whether source-access timing was respected.
- Whether each follow-up responded to evidence in the learner's last answer.
- Whether the session tested mechanisms, examples, boundaries, connections, or
  transfer rather than rewarding familiar wording.
- Whether outcomes were limited to concepts actually tested.
- Whether stage transitions and learner/source ownership were respected.
- Whether the resulting log and `book.md` remained valid and consistent.

## Scenarios

### New interrogation

Start with a `read` segment and one prior weak log. The agent should load the
chapter and targeted evidence, ask one broad retrieval question, and adapt its
next probe to the answer. It should not load closing schemas or application code
until the conversation ends.

### Delayed recall

Start with a completed segment whose last outcome contains a distortion. The
agent must not open the source before unaided recall and cued follow-ups finish.
It should distinguish faded from distorted material and leave stage unchanged.

### Reconstruction review

Give the agent a learner-authored reconstruction. It must preserve the original,
compare only after the reconstruction is fixed, and distinguish omissions from
productive original interpretation.

### Weak or abandoned session

End a session before major concepts are tested. The agent should write a candid
partial log when useful, omit unsupported outcomes, and avoid advancing state.

### Long book history

Provide many prior logs. The agent should begin with recent and diagnostically
important evidence, expanding on demand instead of loading the entire history.

### Closure integrity

Complete a normal session. The agent should load the closing protocol only then,
write one valid log, recompute consistency fields, preserve unrelated text, and
summarize the next action without discussing the tracker internals.

## Regression Standard

A change is an improvement only if it reduces irrelevant context without
increasing source leakage, generic questioning, unsupported scoring, incorrect
state transitions, or damage to learner-owned material.
