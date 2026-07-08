import { useCallback, useEffect, useState } from "react";
import type {
  BookSummary,
  SessionLog,
  StatsPayload,
  TodayPayload,
} from "../../shared/types";
import { api, subscribeWorkspace } from "./lib/api";
import { useTheme } from "./lib/theme";
import { persistView, readInitialView, type View } from "./lib/view";
import { Today } from "./components/Today";
import { Library } from "./components/Library";
import { Kanban } from "./components/Kanban";
import { Timeline } from "./components/Timeline";
import { Stats } from "./components/Stats";
import { BookDetail } from "./components/BookDetail";
import { LogModal, type LogRef } from "./components/LogModal";
import { SearchOverlay } from "./components/SearchOverlay";
import { ThemeToggle } from "./components/ThemeToggle";
import { ViewSwitcher } from "./components/ViewSwitcher";

export default function App() {
  const [books, setBooks] = useState<BookSummary[] | null>(null);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [today, setToday] = useState<TodayPayload | null>(null);
  const [stats, setStats] = useState<StatsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [openLog, setOpenLog] = useState<LogRef | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [theme, , toggleTheme] = useTheme();
  const [view, setView] = useState<View>(() => readInitialView());

  const changeView = useCallback((next: View) => {
    setView(next);
    persistView(next);
  }, []);

  const load = useCallback(() => {
    Promise.all([api.books(), api.timeline(), api.today(), api.stats()])
      .then(([b, l, t, s]) => {
        setBooks(b);
        setLogs(l);
        setToday(t);
        setStats(s);
      })
      .catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    load();
    const off = subscribeWorkspace(load);
    return off;
  }, [load]);

  const openLogFile = useCallback((book: string, file: string) => {
    setOpenLog({ book, file });
  }, []);

  // ⌘K / Ctrl+K opens search from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <ViewSwitcher
        view={view}
        onChange={changeView}
        onSearch={() => setSearchOpen(true)}
      />
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      {error ? (
        <FullError error={error} />
      ) : !books ? (
        <FullLoading />
      ) : (
        <>
          {view === "today" &&
            (today ? <Today today={today} onOpen={setOpenSlug} /> : <FullLoading />)}
          {view === "library" && <Library books={books} onOpen={setOpenSlug} />}
          {view === "kanban" && <Kanban books={books} onOpen={setOpenSlug} />}
          {view === "timeline" && (
            <Timeline
              books={books}
              logs={logs}
              onOpen={setOpenSlug}
              onOpenLog={openLogFile}
            />
          )}
          {view === "stats" &&
            (stats ? (
              <Stats stats={stats} books={books} onOpen={setOpenSlug} />
            ) : (
              <FullLoading />
            ))}
          {openSlug && (
            <BookDetail
              slug={openSlug}
              onClose={() => setOpenSlug(null)}
              onOpenLog={openLogFile}
            />
          )}
          {openLog && <LogModal logRef={openLog} onClose={() => setOpenLog(null)} />}
          {searchOpen && (
            <SearchOverlay
              onClose={() => setSearchOpen(false)}
              onOpenBook={setOpenSlug}
              onOpenLog={openLogFile}
            />
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
