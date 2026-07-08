export type View = "today" | "library" | "kanban" | "timeline" | "stats";

const STORAGE_KEY = "effortful-view";

const VALID_VIEWS: View[] = ["today", "library", "kanban", "timeline", "stats"];

export function readInitialView(): View {
  if (typeof window === "undefined") return "today";
  const stored = localStorage.getItem(STORAGE_KEY) as View | null;
  if (stored && VALID_VIEWS.includes(stored)) return stored;
  return "today";
}

export function persistView(view: View) {
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    /* private mode */
  }
}

export function daysSince(isoDate: string | undefined, today = new Date()): number | null {
  if (!isoDate) return null;
  const then = new Date(isoDate);
  if (Number.isNaN(then.getTime())) return null;
  const ms = today.getTime() - then.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function formatDaysAgo(n: number | null): string {
  if (n === null) return "—";
  if (n === 0) return "Today";
  if (n === 1) return "1 day ago";
  if (n < 7) return `${n} days ago`;
  if (n < 14) return "1 week ago";
  if (n < 30) return `${Math.floor(n / 7)} weeks ago`;
  if (n < 60) return "1 month ago";
  if (n < 365) return `${Math.floor(n / 30)} months ago`;
  return `${Math.floor(n / 365)}y ago`;
}
