import { serviceFor } from "./workspace.js";

export function searchWorkspace(workspace: string, query: string) {
  return serviceFor(workspace).search(query);
}
