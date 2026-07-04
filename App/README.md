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
- `frontend/`: React interface for Library, Kanban, Timeline, and Book Detail views.
- `shared/`: shared types and parsing helpers, if useful.

## Constraints

- No database.
- No AI API calls.
- The filesystem workspace remains the source of truth.
- The app may read files and render state, but should not modify learning content.
