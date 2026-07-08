# Effortful Learning Tracker App

This folder contains the local read-only tracker app for an Effortful Learning
workspace.

The filesystem workspace remains the source of truth. In a public checkout the
app falls back to `../Learning.example`; on your own machine it can read a
private vault from `../Learning` or from `LEARNING_WORKSPACE`.

## Workspace Resolution

The backend resolves the workspace in this order:

1. `LEARNING_WORKSPACE`
2. `../Learning/.system/config.json`
3. `../Learning.example/.system/config.json`
4. `~/learning`

This lets the public repo ship a safe demo while private notes stay outside the
public history.

## Shape

- `backend/`: local file-serving API that reads the learning workspace and exposes JSON.
- `frontend/`: React interface for the views below, plus Book Detail and a
  full-log reading panel.
- `shared/`: shared types and parsing helpers, if useful.

## Views

- **Today ("The Desk")**: the landing view. A review queue of segments whose
  memory is due for another retrieval pass, the next pipeline move per book,
  reviews coming due within a week, and the week's effort at a glance.
- **Library**: the shelves.
- **Board**: kanban of books by status.
- **Chronicle**: the session timeline. Each entry links to the full log.
- **Ledger**: charts — weekly effort, retention over time (from `outcomes`
  scores in log frontmatter), stage distribution, and a per-book difficulty
  ledger.

Search the whole vault (sources, logs, reconstructions, cards, notes) with
`⌘K` / `Ctrl+K`.

## The Review Schedule

The scheduler writes nothing. For each segment it derives, from the logs
alone: how many retrieval sessions have happened, when the segment was last
touched, and how the latest retrieval went (`outcomes` frontmatter). The next
review date is an interval ladder (3, 7, 21, 60, 120 days) scaled by segment
difficulty and by the last measured recall. Because it is derived, deleting or
editing a log automatically corrects the schedule.

## Constraints

- No database.
- No AI API calls.
- The filesystem workspace remains the source of truth.
- The app may read files and render state, but should not modify learning content.
