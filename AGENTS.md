# Project Instructions

This workspace is the Effortful Learning System.

Before doing substantive work in this project, read:

1. `Learning/.system/CONTEXT.md` if a private local vault exists; otherwise `Learning.example/.system/CONTEXT.md`
2. The relevant prompt in that workspace's `.system/prompts/`
3. The relevant `books/{book}/book.md`, if the work concerns a specific book

Treat `Learning/` as the source of truth when it exists locally. Treat
`Learning.example/` as public demo data and parser fixtures. The app is a
read-only tracker unless the user explicitly asks to change app code.

This public repository is the canonical home of the application. Private
repositories should contain learning data, not a second maintained copy of
`App/`. Use `LEARNING_WORKSPACE` to run this app against an external private
vault.

Do not commit private learning data. Keep public examples synthetic or clearly
public-domain.
