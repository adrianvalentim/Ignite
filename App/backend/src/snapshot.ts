import { localToday } from "../../shared/schedule.js";
import { buildWorkspaceSnapshot } from "../../shared/snapshot.js";
import type { WorkspaceSnapshot } from "../../shared/types.js";
import { readWorkspaceData } from "./workspace.js";

export async function buildSnapshot(
  workspace: string,
  todayISO = localToday(),
): Promise<WorkspaceSnapshot> {
  return buildWorkspaceSnapshot(await readWorkspaceData(workspace), todayISO);
}
