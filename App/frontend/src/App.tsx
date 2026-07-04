import { useCallback, useEffect, useState } from "react";
import type { BookSummary, SessionLog } from "../../shared/types";
import { api, subscribeWorkspace } from "./lib/api";
import { useTheme } from "./lib/theme";
import { persistView, readInitialView, type View } from "./lib/view";
import { Library } from "./components/Library";
import { Kanban } from "./components/Kanban";
import { Timeline } from "./components/Timeline";
import { BookDetail } from "./components/BookDetail";
import { ThemeToggle } from "./components/ThemeToggle";
import { ViewSwitcher } from "./components/ViewSwitcher";

export default function App() {
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [theme, , toggleTheme] = useTheme();
  const [view, setView] = useState<View>(() => readInitialView());

  const changeView = useCallback((next: View) => {
    setView(next);
    persistView(next);
  }, []);

  const load = useCallback(() => {
    Promise.all([api.books(), api.timeline()])
      .then(([b, l]) => {
        setBooks(b);
        setLogs(l);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    load();
    const off = subscribeWorkspace(load);
    return off;
  }, [load]);

  return (
    <>
      <ViewSwitcher view={view} onChange={changeView} />
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      {error ? (
        <FullError error={error} />
      ) : !books ? (
        <FullLoading />
      ) : (
        <>
          {view === "library" && <Library books={books} onOpen={setOpenSlug} />}
          {view === "kanban" && <Kanban books={books} onOpen={setOpenSlug} />}
          {view === "timeline" && (
            <Timeline books={books} logs={logs} onOpen={setOpenSlug} />
          )}
          {openSlug && (
            <BookDetail slug={openSlug} onClose={() => setOpenSlug(null)} />
          )}
        </>
      )}
    </>
  );
}

function FullLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-dim">
        Loading workspace…
      </div>
    </div>
  );
}

function FullError({ error }: { error: string }) {
  return (
    <div className="mx-auto max-w-xl px-8 py-24">
      <h1
        className="font-display text-3xl text-ink"
        style={{ fontVariationSettings: '"opsz" 144, "wght" 380' }}
      >
        The workspace is silent.
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
        The backend could not be reached. Start it with{" "}
        <span className="font-mono text-[12.5px] text-ink-dim">pnpm -C backend dev</span>.
      </p>
      <pre className="mt-6 overflow-auto rounded-sm border border-line-strong p-4 font-mono text-[11.5px] text-ink-dim">
        {error}
      </pre>
    </div>
  );
}
