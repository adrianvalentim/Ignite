import type {
  BookDetail,
  BookSummary,
  LogDetail,
  SearchResult,
  SessionLog,
  StatsPayload,
  TodayPayload,
  WorkspaceSnapshot,
} from "@shared/types";
import {
  desktopApi,
  isDesktopApp,
  subscribeDesktopWorkspace,
} from "./desktop";

interface TrackerApi {
  snapshot(): Promise<WorkspaceSnapshot>;
  books(): Promise<BookSummary[]>;
  book(slug: string): Promise<BookDetail | null>;
  timeline(): Promise<SessionLog[]>;
  today(): Promise<TodayPayload>;
  stats(): Promise<StatsPayload>;
  log(book: string, file: string): Promise<LogDetail | null>;
  search(query: string): Promise<SearchResult[]>;
}

async function get<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return (await response.json()) as T;
}

const browserApi: TrackerApi = {
  snapshot: () => get<WorkspaceSnapshot>("/api/snapshot"),
  books: () => get<{ books: BookSummary[] }>("/api/books").then((r) => r.books),
  book: (slug) => get<BookDetail>(`/api/books/${slug}`),
  timeline: () =>
    get<{ logs: SessionLog[] }>("/api/timeline").then((r) => r.logs),
  today: () => get<TodayPayload>("/api/today"),
  stats: () => get<StatsPayload>("/api/stats"),
  log: (book, file) =>
    get<LogDetail>(`/api/books/${book}/logs/${encodeURIComponent(file)}`),
  search: (query) =>
    get<{ results: SearchResult[] }>(
      `/api/search?q=${encodeURIComponent(query)}`,
    ).then((r) => r.results),
};

export const api: TrackerApi = isDesktopApp() ? desktopApi : browserApi;

export async function subscribeWorkspace(
  onChange: () => void,
  signal?: AbortSignal,
): Promise<() => void> {
  if (isDesktopApp()) return subscribeDesktopWorkspace(onChange);
  const events = new EventSource("/api/events");
  events.addEventListener("workspace-changed", onChange);

  const stop = () => {
    events.removeEventListener("workspace-changed", onChange);
    events.close();
  };

  if (signal?.aborted) {
    stop();
    return () => undefined;
  }

  return new Promise((resolve, reject) => {
    const removeStartupListeners = () => {
      events.removeEventListener("open", handleOpen);
      events.removeEventListener("error", handleError);
      signal?.removeEventListener("abort", handleAbort);
    };
    const handleOpen = () => {
      removeStartupListeners();
      resolve(stop);
    };
    const handleError = () => {
      removeStartupListeners();
      stop();
      reject(new Error("Could not connect to workspace events"));
    };
    const handleAbort = () => {
      removeStartupListeners();
      stop();
      resolve(() => undefined);
    };

    events.addEventListener("open", handleOpen, { once: true });
    events.addEventListener("error", handleError, { once: true });
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}
