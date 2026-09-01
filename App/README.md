# Ignite Tracker App

This folder contains the tracker for an Ignite learning workspace. The
recommended interface is a Tauri 2 desktop app; the original local
browser/server mode remains available. The desktop app also provides a Codex
chat backed by the locally installed Codex CLI and the user's existing ChatGPT
sign-in.

The learning vault stays outside the application and remains the source of
truth. There is no database. The tracker filesystem adapter remains read-only;
only the separate Codex process can propose and perform changes, under Codex's
normal sandbox and approval flow.

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

On macOS, choose **Ignite → Reload** or press **Cmd+R** to reload the
current interface on demand. Development mode will then request the latest Vite
output. An installed production app must first be rebuilt and reinstalled before
Reload can show changed bundled code.

### Codex Chat

Open the **Codex** view to start a chat or resume existing Codex CLI, editor,
and app-server chats associated with the selected workspace. New chats use the
selected Learning folder as their working directory, `workspace-write`
sandboxing, and user-reviewed approvals.

The app starts `codex app-server` over local stdio. It does not ask for an API
key or wrap the OpenAI API directly. Authenticate the installed CLI with your
ChatGPT subscription before opening the app:

```bash
codex login
codex login status
```

On macOS, the app also discovers the Codex binary bundled with ChatGPT. On any
platform, set `CODEX_EXECUTABLE` to an explicit Codex CLI path if it is not on
the GUI application's `PATH`.

This does not replace other entry points. Codex or Claude Code can still run in
a terminal and update the same external vault; the tracker watcher will pick up
those changes. Claude chat is not embedded in this version.

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
All tracker views continue to work in this mode. Codex chat is desktop-only
because its bridge is a native child process; the browser view explains how to
open it in Tauri.

## Architecture

- `frontend/`: the React/Vite interface, Codex App Server protocol client, a
  Tauri filesystem adapter, and the original HTTP adapter.
- `shared/`: filesystem-independent parsing, search, scheduling, statistics,
  and types used by both application modes.
- `backend/`: the optional Fastify file-serving API and its Node filesystem
  adapter.
- `src-tauri/`: the small Rust shell, desktop capabilities, local Codex stdio
  bridge, plugins, bundle configuration, and icons.

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
- **Codex**: local subscription-backed Codex chat, history, streaming activity,
  approvals, and user-input prompts.

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
- No direct AI API integration and no API key handling in the app.
- No learning-content write permissions in the tracker adapter. Codex changes
  remain isolated behind its own workspace sandbox and approvals.
- No private learning data in this public repository.
