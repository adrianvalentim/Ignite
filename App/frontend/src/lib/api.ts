import type {
  BookDetail,
  BookSummary,
  LogDetail,
  SearchResult,
  SessionLog,
  StatsPayload,
  TodayPayload,
} from "../../../shared/types";

const base = ""; // proxied through Vite at /api/*

async function get<T>(url: string): Promise<T> {
  const res = await fetch(base + url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

export const api = {
  books: () => get<{ books: BookSummary[] }>("/api/books").then((r) => r.books),
  book: (slug: string) => get<BookDetail>(`/api/books/${slug}`),
  timeline: () =>
    get<{ logs: SessionLog[] }>("/api/timeline").then((r) => r.logs),
  today: () => get<TodayPayload>("/api/today"),
  stats: () => get<StatsPayload>("/api/stats"),
  log: (book: string, file: string) =>
    get<LogDetail>(`/api/books/${book}/logs/${encodeURIComponent(file)}`),
  search: (q: string) =>
    get<{ results: SearchResult[] }>(
      `/api/search?q=${encodeURIComponent(q)}`,
    ).then((r) => r.results),
};

// Server-sent events: silent live reload when the workspace changes on disk.
export function subscribeWorkspace(onChange: () => void): () => void {
  const es = new EventSource("/api/events");
  es.addEventListener("workspace-changed", onChange);
  return () => es.close();
}
