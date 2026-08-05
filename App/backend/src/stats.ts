import type { StatsPayload } from "../../shared/types.js";
import { buildStatsFrom } from "../../shared/stats.js";
import { localToday } from "../../shared/schedule.js";
import { readAllBooks, readAllLogs } from "./workspace.js";

export { buildStatsFrom };

export async function buildStats(workspace: string): Promise<StatsPayload> {
  const [books, logs] = await Promise.all([
    readAllBooks(workspace),
    readAllLogs(workspace),
  ]);
  return buildStatsFrom(books, logs, localToday());
}
