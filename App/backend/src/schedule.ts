import type { TodayPayload } from "../../shared/types.js";
import {
  buildTodayFrom,
  intervalDays,
  localToday,
  logMatchesSegment,
  parseDurationMinutes,
} from "../../shared/schedule.js";
import { readWorkspaceData } from "./workspace.js";

export {
  buildTodayFrom,
  intervalDays,
  localToday,
  logMatchesSegment,
  parseDurationMinutes,
};

export async function buildToday(workspace: string): Promise<TodayPayload> {
  const { books, logs } = await readWorkspaceData(workspace);
  return buildTodayFrom(books, logs, localToday());
}
