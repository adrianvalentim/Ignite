import { useCallback, useEffect, useState } from "react";
import type {
  BookSummary,
  SessionLog,
  StatsPayload,
  TodayPayload,
} from "../../shared/types";
import { api, subscribeWorkspace } from "./lib/api";
import {
  chooseWorkspace,
  currentWorkspace,
  isDesktopApp,
} from "./lib/desktop";
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
  const desktop = isDesktopApp();
  const [workspacePath, setWorkspacePath] = useState<string | null>(() =>
    currentWorkspace(),
  );
  const [choosingWorkspace, setChoosingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
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

  const load = useCallback(async () => {
    setError(null);
    try {
      const [nextBooks, nextLogs, nextToday, nextStats] = await Promise.all([
        api.books(),
        api.timeline(),
        api.today(),
        api.stats(),
      ]);
      setBooks(nextBooks);
      setLogs(nextLogs);
      setToday(nextToday);
      setStats(nextStats);
    } catch (loadError) {
      setError(String(loadError));
    }
  }, []);

  const selectWorkspace = useCallback(async () => {
    setChoosingWorkspace(true);
    setWorkspaceError(null);
    try {
      const selected = await chooseWorkspace();
      if (selected) {
        setBooks(null);
        setLogs([]);
        setToday(null);
        setStats(null);
        setError(null);
        setWorkspacePath(selected);
      }
    } catch (selectionError) {
      setWorkspaceError(String(selectionError));
    } finally {
      setChoosingWorkspace(false);
    }
  }, []);

  useEffect(() => {
    if (desktop && !workspacePath) return undefined;
    let active = true;
    let unsubscribe: (() => void) | null = null;
    void load().then(() => {
      if (active) unsubscribe = subscribeWorkspace(load);
    });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [desktop, load, workspacePath]);

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

  if (desktop && !workspacePath) {
    return (
      <>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <WorkspaceSetup
          choosing={choosingWorkspace}
          error={workspaceError}
          onChoose={selectWorkspace}
        />
      </>
    );
  }

  return (
    <>
      <ViewSwitcher
        view={view}
        onChange={changeView}
        onSearch={() => setSearchOpen(true)}
      />
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      {desktop && workspacePath && (
        <WorkspaceControl path={workspacePath} onChoose={selectWorkspace} />
      )}
      {error ? (
        <FullError
          error={error}
          desktop={desktop}
          onChoose={desktop ? selectWorkspace : undefined}
        />
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

function WorkspaceSetup({
  choosing,
  error,
  onChoose,
}: {
  choosing: boolean;
  error: string | null;
  onChoose: () => void;
}) {
  return (
    <main className="flex h-full items-center justify-center px-8">
      <section className="grain grain-paper w-full max-w-xl overflow-hidden rounded-sm border border-line-strong bg-paper px-10 py-12 text-ink-paper shadow-2xl">
        <div className="relative z-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-amber">
            First launch
          </p>
          <h1
            className="mt-4 font-display text-4xl leading-tight"
            style={{ fontVariationSettings: '"opsz" 72, "wght" 390' }}
          >
            Open your Learning workspace.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
            Choose the folder that contains your books. The app receives read-only
            access, keeps the vault outside the application, and refreshes when an
            agent updates its files.
          </p>
          <button
            type="button"
            disabled={choosing}
            onClick={onChoose}
            className="mt-8 rounded-sm bg-ink-paper px-5 py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-paper transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-50"
          >
            {choosing ? "Opening…" : "Choose workspace"}
          </button>
          {error && (
            <p className="mt-5 rounded-sm border border-rust/30 bg-rust/10 p-3 font-mono text-[11px] leading-relaxed text-rust">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

function WorkspaceControl({
  path,
  onChoose,
}: {
  path: string;
  onChoose: () => void;
}) {
  const name = path.replaceAll("\\", "/").split("/").filter(Boolean).at(-1);
  return (
    <button
      type="button"
      title={`Change workspace: ${path}`}
      onClick={onChoose}
      className="fixed left-5 top-5 z-40 max-w-52 truncate rounded-sm border border-line bg-bg-elev/90 px-3 py-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-dim backdrop-blur transition-colors hover:border-line-strong hover:text-ink-soft"
    >
      {name ?? "Workspace"}
    </button>
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

function FullError({
  error,
  desktop,
  onChoose,
}: {
  error: string;
  desktop: boolean;
  onChoose?: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl px-8 py-24">
      <h1
        className="font-display text-3xl text-ink"
        style={{ fontVariationSettings: '"opsz" 144, "wght" 380' }}
      >
        The workspace is silent.
      </h1>
      <p className="mt-3 text-[14.5px] leading-relaxed text-ink-soft">
        {desktop ? (
          "The selected workspace could not be read. You can choose it again without changing any learning files."
        ) : (
          <>
            The backend could not be reached. Start it with{" "}
            <span className="font-mono text-[12.5px] text-ink-dim">
              pnpm -C backend dev
            </span>
            .
          </>
        )}
      </p>
      {onChoose && (
        <button
          type="button"
          onClick={onChoose}
          className="mt-6 rounded-sm border border-line-strong px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft hover:text-ink"
        >
          Choose another workspace
        </button>
      )}
      <pre className="mt-6 overflow-auto rounded-sm border border-line-strong p-4 font-mono text-[11.5px] text-ink-dim">
        {error}
      </pre>
    </div>
  );
}
