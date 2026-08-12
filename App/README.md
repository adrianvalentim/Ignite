# Effortful Learning Tracker App

This folder contains the read-only tracker for an Effortful Learning workspace.
The recommended interface is now a Tauri 2 desktop app; the original local
browser/server mode remains available.

The learning vault stays outside the application and remains the source of
truth. There is no database and the app has no command that can write learning
content.

## Run the Desktop App

Install Node.js, pnpm, and Rust, then from this folder run:

```bash
pnpm install
pnpm desktop:dev
```

On first launch, choose the `Learning` folder that contains `books/`. The
folder-picker grant is remembered across launches. Access is recursive within
that selected folder, but the Tauri capability contains only read, metadata,
and watch permissions.

An open window watches `books/` and `cross-book/`. When Codex, Claude Code, or
another process updates a valid vault file, the current views silently reload.
Changing app code during `desktop:dev` uses Vite's normal hot reload.

Useful commands:

```bash
pnpm desktop:check
pnpm desktop:build --no-bundle
pnpm desktop:build --bundles app --no-sign
```

The wrapper in `scripts/tauri.mjs` places Cargo's disposable build cache in the
operating system's temporary directory. This avoids macOS AppleDouble metadata
problems when the repository lives on an external volume. Set
`CARGO_TARGET_DIR` yourself to override that location.

## Distribution

`desktop:build` produces the native artifact for the operating system on which
it runs. macOS, Windows, and Linux all use the same React interface and shared
TypeScript vault core; each platform still needs its own native toolchain and
release build.

For personal local use on macOS, an unsigned `.app` build is enough. Giving the
app to other Mac users cleanly requires an Apple Developer identity, signing,
and notarization. A future release workflow can build signed installers on each
platform and add Tauri's updater; that updater is not part of this first desktop
milestone.

## Browser/Server Mode

Run both the Fastify backend and Vite frontend with:

```bash
pnpm dev
```

The backend resolves the workspace in this order:

1. `LEARNING_WORKSPACE`
2. `../Learning/.system/config.json`
3. `../Learning.example/.system/config.json`
4. `~/learning`

This mode is useful for ordinary browser development and remains behaviorally
aligned with the desktop app because both use the same shared vault core.

## Architecture

- `frontend/`: the React/Vite interface plus a Tauri filesystem adapter and the
  original HTTP adapter.
- `shared/`: filesystem-independent parsing, search, scheduling, statistics,
  and types used by both application modes.
- `backend/`: the optional Fastify file-serving API and its Node filesystem
  adapter.
- `src-tauri/`: the small Rust shell, desktop capabilities, plugins, bundle
  configuration, and icons.

Rust owns the native window and operating-system permissions. Product behavior
stays in TypeScript, so most interface and learning-system changes use the same
React workflow as before.

Each top-level refresh reads book metadata and session logs once into a shared
workspace snapshot. Today, Library, Board, Chronicle, and Ledger are derived
from that same immutable in-memory value in both desktop and browser modes.
Filesystem notifications are serialized and coalesced so refresh reads never
overlap.

Fraunces, Inter, and JetBrains Mono are bundled locally as variable WOFF2
assets with their licenses. The interface therefore keeps its typography when
offline and does not contact Google Fonts at runtime.

## Views

- **Today ("The Desk")**: review queue, pipeline moves, upcoming reviews, and
  the week's effort.
- **Library**: the shelves.
- **Board**: books grouped by status.
- **Chronicle**: the session timeline with full-log reading.
- **Ledger**: weekly effort, retention, stage distribution, and difficulty.

Search the whole vault with `Cmd+K` on macOS or `Ctrl+K` on Windows and Linux.

## Validation

```bash
pnpm check
```

The check runs the backend tests against the public synthetic workspace, builds
the frontend, and validates the Tauri permission manifest and native shell.

## Review Schedule and Constraints

The scheduler writes nothing. It derives review dates from book metadata and
session logs, including retrieval count, difficulty, and recorded outcomes.
Editing or deleting a log therefore corrects the schedule on the next refresh.

- No database.
- No AI API calls.
- No learning-content write permissions.
- No private learning data in this public repository.
