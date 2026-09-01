import type { StatsPayload } from "../../shared/types.js";
import { buildStatsFrom } from "../../shared/stats.js";
import { localToday } from "../../shared/schedule.js";
import { readWorkspaceData } from "./workspace.js";

export { buildStatsFrom };

export async function buildStats(workspace: string): Promise<StatsPayload> {
  const { books, logs } = await readWorkspaceData(workspace);
  return buildStatsFrom(books, logs, localToday());
}
