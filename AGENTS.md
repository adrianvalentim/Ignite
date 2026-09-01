# Project Instructions

This workspace is Ignite, an effortful learning system. It contains two different
kinds of work. Route the request before loading detailed instructions.

## Learning Sessions

For book setup, interrogation, reconstruction review, recall, Feynman work,
card generation, or examination:

1. Identify the active learning workspace. Use `Learning/` when it exists and
   the user has not selected another workspace; otherwise use
   `Learning.example/` for public examples and parser fixtures.
2. Read that workspace's `.system/CONTEXT.md`. Read its `.system/ROUTER.md` when
   present; otherwise use `Learning.example/.system/ROUTER.md` and its generic
   prompts, protocols, and schemas. Never substitute example book data for the
   active workspace's book data.
3. Read the relevant `books/{book}/book.md` when the work concerns a book.
4. Use the router to select exactly one phase prompt and its phase-specific
   evidence. Respect its source-access timing.
5. During a teaching conversation, do not load closing formats or persistence
   instructions. When the pedagogical work is finished, load
   `protocols/session-close.md` from the selected instruction bundle and the
   files it names.

The Book Map is recommended but optional for older vaults. If it is absent, use
the segment list, Current State, Key Insights, and Difficulties without blocking
the session.

Do not inspect `App/`, its API, or its interface during a learning session. The
app is a passive, read-only consumer of valid vault files. Inspect app code only
when the user explicitly asks to change or diagnose application behavior, or a
valid vault artifact fails to render.

## Application Work

For tracker changes, read `App/README.md` and the relevant application code.
The application is read-only unless the user explicitly asks to change that
contract. This public repository is the canonical home of `App/`; private
repositories should contain learning data, not another maintained app copy.
Use `LEARNING_WORKSPACE` to run the app against an external private vault.

## Privacy

Do not commit private learning data. Keep public examples synthetic or clearly
public-domain. Preserve learner-authored work and stable source material unless
the user explicitly requests a change.
