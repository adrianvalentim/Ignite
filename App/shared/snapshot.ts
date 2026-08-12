import { buildTodayFrom } from "./schedule.js";
import { buildStatsFrom } from "./stats.js";
import type { WorkspaceData, WorkspaceSnapshot } from "./types.js";

/** Derive every top-level view from one coherent read of the workspace. */
export function buildWorkspaceSnapshot(
  data: WorkspaceData,
  todayISO: string,
): WorkspaceSnapshot {
  return {
    books: data.books,
    logs: data.logs,
    today: buildTodayFrom(data.books, data.logs, todayISO),
    stats: buildStatsFrom(data.books, data.logs, todayISO),
  };
}
