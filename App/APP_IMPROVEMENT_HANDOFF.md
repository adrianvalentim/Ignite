# App Improvement Handoff

## Purpose

This document describes a small, measured improvement pass for the Effortful
Learning tracker. The goal is to reduce repeated filesystem work, simplify the
development installation, make the interface fully offline, and harden live
refresh behavior without changing what the application does or making future
product work harder.

The changes should preserve both supported interfaces:

- the Tauri 2 desktop app;
- the Fastify plus Vite browser development mode.

The work should remain in React and TypeScript except for ordinary Tauri
configuration. Do not move application logic into Rust.

## Current State

The implementation described here is based on commit `9165a50` on
`codex/tauri-desktop`.

The application currently has:

- a React/Vite interface;
- a minimal Tauri 2 native shell;
- a Fastify backend for browser mode;
- a shared TypeScript vault, scheduler, statistics, and search core;
- a user-selected external Learning workspace;
- read, metadata, and watch permissions, but no learning-content write
  permission;
- automatic refresh after relevant filesystem changes.

At startup and after every detected change, `App.tsx` requests books, logs,
Today, and Ledger data independently. In desktop mode, Today and Ledger each
read books and logs again. This makes one logical refresh traverse the same
metadata and session logs several times.

The current development layout also runs three independent pnpm installations:
one in `App/`, one in `App/backend/`, and one in `App/frontend/`. It therefore
maintains three lockfiles and three package stores.

The HTML entry point loads Fraunces, Inter, and JetBrains Mono from Google Fonts
at runtime.

## Measured Baseline

These measurements were taken during the original audit. They are context, not
performance targets that must be reproduced exactly on another machine.

- packaged macOS app: approximately 11 MB;
- idle main-process memory: approximately 75 MB RSS;
- frontend bundle: approximately 410 KB JavaScript, 126 KB gzip;
- representative full refresh with repeated reads: 3.14 ms median;
- representative refresh using one shared books/logs snapshot: 1.35 ms median;
- representative vault search: 18.8 ms median;
- the three pnpm package stores occupied approximately 2.7 GB in total.

The app is already lightweight. This is a maintainability and scaling pass, not
a response to a user-visible performance failure.

## Non-Negotiable Constraints

1. The external Markdown vault remains the source of truth.
2. The application remains read-only with respect to learning content.
3. Do not add a database, cache files inside the vault, or a background service.
4. Do not commit private learning data, private paths, or real learner content.
   Automated fixtures must continue to use `Learning.example/` or synthetic
   in-memory data.
5. Desktop and browser modes must derive the same results from the shared
   TypeScript core.
6. Preserve all current views, search behavior, book/log modals, theme state,
   workspace selection, and automatic refresh behavior.
7. Preserve existing public API endpoints unless there is a compelling reason
   to deprecate them. Adding a snapshot endpoint is acceptable.
8. Keep the code easy for an agent or human to modify. Prefer small explicit
   functions and types over a new framework or generalized caching system.
9. Do not introduce search indexing, list virtualization, aggressive route
   splitting, or new Rust business logic in this pass. Current measurements do
   not justify them.

## Priority 1: Load One Immutable Workspace Snapshot

### Problem

`App/frontend/src/App.tsx` currently performs:

```ts
Promise.all([
  api.books(),
  api.timeline(),
  api.today(),
  api.stats(),
]);
```

In desktop mode, `today()` and `stats()` in
`App/frontend/src/lib/desktop.ts` each call `readAllBooks()` and
`readAllLogs()` again. `readAllBooks()` also reads each book's logs to derive
`last_active`. One screen refresh therefore repeats directory listings,
metadata parsing, and log parsing.

### Desired Design

Add a typed snapshot that is created from one coherent read of the workspace:

```ts
interface WorkspaceSnapshot {
  books: BookSummary[];
  logs: SessionLog[];
  today: TodayPayload;
  stats: StatsPayload;
}
```

Suggested implementation:

1. Add a shared source-data type, for example:

   ```ts
   interface WorkspaceData {
     books: BookSummary[];
     logs: SessionLog[];
   }
   ```

2. Extend `VaultService` with a method such as `readWorkspaceData()`.
3. Internally read every recognized book and its session logs once. A helper
   can return `{ book, logs }` for one slug. Flatten and globally sort the logs
   after all books have been read.
4. Derive each book's `progress.last_active` from the same logs returned in that
   book's bundle. Do not call `readSessionLogs()` again for the summary.
5. Build `WorkspaceSnapshot` from that source data with
   `buildTodayFrom(books, logs, todayISO)` and
   `buildStatsFrom(books, logs, todayISO)`. Pass `todayISO` into the shared
   function so both environments choose the date explicitly.
6. Add `snapshot()` to the frontend `TrackerApi`.
7. In desktop mode, `snapshot()` should call `readWorkspaceData()` once and
   derive Today and Ledger from it.
8. In browser mode, add `GET /api/snapshot`, backed by the same shared
   snapshot-building path.
9. Change `App.tsx` to perform one `api.snapshot()` call and update its four
   state values from that single result.
10. Keep the existing books, timeline, Today, and stats endpoints working for
    compatibility and focused requests.

The snapshot should be immutable by convention. It only needs to live in React
state; do not persist it to disk or add a global cache with invalidation rules.

### Tests

- Verify that snapshot results equal the results of the existing individual
  readers on `Learning.example/`.
- Add a synthetic counting `VaultReader` test demonstrating that one snapshot
  reads each `book.md` and log file once.
- Verify that a book directory without `book.md` is still ignored.
- Verify that path traversal protections and missing optional directories keep
  their current behavior.
- Verify that a failed snapshot does not partially replace the four pieces of
  currently displayed state.

## Priority 2: Consolidate the pnpm Workspace

### Problem

The repository currently has:

- `App/pnpm-lock.yaml`;
- `App/backend/pnpm-lock.yaml`;
- `App/frontend/pnpm-lock.yaml`;
- three independent install commands and dependency stores.

This makes dependency updates noisier and consumes unnecessary development
disk space.

### Desired Design

1. Add `App/pnpm-workspace.yaml`:

   ```yaml
   packages:
     - backend
     - frontend
   ```

2. Keep dependencies owned by the package that imports them. Do not move all
   dependencies into the root package merely to shorten manifests.
3. Regenerate one authoritative `App/pnpm-lock.yaml` from the workspace root.
4. Remove the two nested lockfiles.
5. Simplify `install:all` to `pnpm install`, or retain the script as a clear
   alias that runs only the root install.
6. Confirm that these commands still work from `App/`:

   ```bash
   pnpm dev
   pnpm -C backend test
   pnpm -C frontend build
   pnpm desktop:dev
   pnpm desktop:check
   pnpm desktop:build --no-bundle
   ```

7. Add a convenient root validation script, for example:

   ```json
   "check": "pnpm -C backend test && pnpm -C frontend build && pnpm desktop:check"
   ```

Do not delete existing ignored `node_modules/` directories as part of the code
change. They are rebuildable local data, but removing them should be an
explicit local cleanup decision. The committed improvement is the workspace
layout and single lockfile.

## Priority 3: Package the Existing Fonts Locally

### Problem

`App/frontend/index.html` currently contacts Google Fonts whenever the app is
opened. That introduces a network dependency, can cause fallback-font flashes,
and requires broader CSP allowances than a local desktop reader needs.

### Desired Design

1. Package the exact currently used families and ranges as WOFF2 assets:

   - Fraunces variable: optical size, weight 300–900, SOFT, and WONK axes;
   - Inter: weight 300–700;
   - JetBrains Mono: weights 400–500.

2. Obtain the font files from their official upstream projects or another
   authoritative distribution source.
3. Include the applicable font license files in the repository beside the font
   assets.
4. Declare the fonts with `@font-face` in a dedicated stylesheet or near the
   top of `styles.css`.
5. Keep the current CSS family names and fallback stacks unchanged so no
   component code needs to change.
6. Remove the Google Fonts `preconnect` and stylesheet elements from
   `frontend/index.html`.
7. Tighten the Tauri CSP by removing Google Fonts domains from `style-src` and
   `font-src`. The packaged fonts should load from `self`.
8. Confirm that the existing Fraunces `fontVariationSettings` still work. The
   selected Fraunces asset must contain the custom axes rather than a reduced
   weight-only build.

### Verification

- Launch the packaged app with network access disabled and confirm that all
  three families render.
- Compare Today, Library, Board, Chronicle, Ledger, search, and the detail
  modals before and after the change at the same window size.
- Check headings, italics, numeric alignment, card wrapping, and modal layout.
- Confirm there are no requests to `fonts.googleapis.com` or
  `fonts.gstatic.com`.

The objective is identical typography with local delivery, not a visual
redesign.

## Priority 4: Harden Filesystem Refresh Coordination

### Problems

- The desktop watcher currently watches the entire selected workspace and then
  filters events by path.
- The React effect subscribes only after the initial load, leaving a small
  interval in which a filesystem change can be missed.
- A burst of changes can begin another full refresh while a previous refresh is
  still running.

### Desired Design

1. Watch only the existing `books/` and `cross-book/` roots.
2. Treat a missing optional `cross-book/` directory as normal. Continue
   watching `books/` rather than failing the whole subscription.
3. Establish the subscription before starting the initial load.
4. Keep debounce behavior so a multi-file agent update becomes one refresh.
5. Serialize and coalesce refreshes:
   - never run two snapshot reads concurrently;
   - if a change occurs while one read is running, remember one pending
     refresh;
   - after the current read finishes, run exactly one more refresh using the
     newest filesystem state;
   - discard state updates after the component unmounts or the workspace
     changes.
6. Preserve silent automatic updates. Do not add polling or a manual refresh
   requirement.
7. Apply equivalent coalescing to browser-mode SSE refreshes in the shared
   frontend coordinator. The backend's chokidar debounce may remain.

Prefer a small, testable refresh coordinator or hook over interleaved booleans
spread across `App.tsx` and `desktop.ts`.

### Tests

- Simulate several notifications during a delayed load and verify that at most
  one load runs at a time and one trailing refresh occurs.
- Verify that an event during initial loading is not lost.
- Verify cleanup on unmount and workspace switching.
- Manually update a synthetic `book.md` and log while the desktop app is open;
  the visible views should update once the write burst settles.

## Recommended Implementation Order

1. Add workspace and snapshot types plus shared snapshot construction.
2. Refactor the vault reader to produce books and logs in one pass.
3. Add desktop and browser snapshot adapters and migrate `App.tsx`.
4. Add refresh serialization and narrow the desktop watch roots.
5. Convert `App/` to a pnpm workspace and regenerate the lockfile.
6. Package fonts locally and tighten CSP.
7. Update `App/README.md` with the new install command, snapshot architecture,
   offline-font behavior, and validation command.
8. Run all validation and perform a desktop smoke test.

Keeping these as logically separate commits is helpful for review, although a
single final pull request is fine.

## Required Validation

Run from the repository root unless otherwise noted:

```bash
pnpm -C App install
pnpm -C App/backend test
pnpm -C App/frontend build
pnpm -C App desktop:check
pnpm -C App desktop:build --no-bundle
git diff --check
```

Also perform these manual checks:

- first launch still requests a workspace;
- the selected workspace remains remembered across launches;
- Today, Library, Board, Chronicle, Ledger, search, book details, and log details
  show the same information as before;
- filesystem changes made by an external agent appear automatically;
- auxiliary directories without `book.md` do not break loading;
- the app has no write permission for learning content;
- the browser/server mode still operates;
- the packaged desktop app renders correctly without internet access;
- no private vault files or paths appear in the Git diff.

## Completion Criteria

This improvement pass is complete when:

- one logical refresh is backed by one coherent workspace-data read;
- Today and Ledger derive from the same books and logs shown elsewhere;
- refreshes are serialized and coalesced;
- desktop watching is limited to relevant workspace roots;
- `App/` uses one pnpm workspace lockfile and one installation;
- the current fonts are bundled locally with their licenses;
- the Tauri CSP no longer permits Google Fonts;
- all automated and manual validation above passes;
- behavior and appearance are unchanged aside from more deterministic offline
  startup.

## Explicitly Out of Scope

- changing the learning model or scheduler;
- editing or migrating private learning content;
- adding app-based editing of the vault;
- adding an internal database;
- implementing a search index;
- virtualizing current lists;
- rewriting shared TypeScript logic in Rust;
- adding a background daemon;
- redesigning the interface;
- signing, notarization, auto-update, or release automation.

If later measurements show a genuine bottleneck, optimize that measured path
separately. Do not pre-emptively add architectural machinery during this pass.
