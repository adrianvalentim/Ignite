import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchKind, SearchResult } from "../../../shared/types";
import { api } from "../lib/api";

interface Props {
  onClose: () => void;
  onOpenBook: (slug: string) => void;
  onOpenLog: (book: string, file: string) => void;
}

const KIND_LABEL: Record<SearchKind, string> = {
  book: "Book",
  source: "Source",
  log: "Log",
  reconstruction: "Reconstruction",
  cards: "Cards",
  thesis: "Thesis",
  essay: "Essay",
  "cross-book": "Cross-book",
};

const KIND_COLOR: Partial<Record<SearchKind, string>> = {
  log: "var(--color-slate-blue)",
  cards: "var(--color-amber)",
  source: "var(--color-green)",
};

export function SearchOverlay({ onClose, onOpenBook, onOpenLog }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search against the local vault.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const t = setTimeout(() => {
      api
        .search(q)
        .then((r) => {
          if (cancelled) return;
          setResults(r);
          setSelected(0);
          setSearching(false);
        })
        .catch(() => !cancelled && setSearching(false));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  const open = (r: SearchResult) => {
    if (r.kind === "log" && r.book && r.log_file) {
      onOpenLog(r.book, r.log_file);
      onClose();
    } else if (r.book) {
      onOpenBook(r.book);
      onClose();
    }
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(results.length - 1, s + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(0, s - 1));
      } else if (e.key === "Enter") {
        const r = results[selected];
        if (r) open(r);
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, selected, onClose]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const terms = useMemo(
    () =>
      query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 2),
    [query],
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh]">
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="fixed inset-0 cursor-default"
        style={{ background: "var(--backdrop)", backdropFilter: "blur(2px)" }}
      />
      <div
        className="fade-rise relative w-full max-w-xl overflow-hidden rounded-sm border"
        style={{
          background: "var(--color-bg-elev)",
          borderColor: "var(--color-line-strong)",
          boxShadow: "var(--shadow-card-hover)",
        }}
        role="dialog"
        aria-label="Search the workspace"
      >
        <div
          className="flex items-center gap-3 border-b px-5 py-4"
          style={{ borderColor: "var(--color-line)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <circle cx="6" cy="6" r="4.2" stroke="var(--color-ink-dim)" strokeWidth="1.3" />
            <line
              x1="9.2"
              y1="9.2"
              x2="12.4"
              y2="12.4"
              stroke="var(--color-ink-dim)"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sources, logs, cards, notes…"
            className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-dim"
            spellCheck={false}
          />
          <span className="font-mono shrink-0 text-[10px] uppercase tracking-[0.22em] text-ink-dim">
            esc
          </span>
        </div>

        <div className="max-h-[52vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <Hint>Type at least two characters. The whole vault is searched.</Hint>
          ) : searching && results.length === 0 ? (
            <Hint>Leafing through the vault…</Hint>
          ) : results.length === 0 ? (
            <Hint>Nothing in the vault matches “{query.trim()}”.</Hint>
          ) : (
            <ol ref={listRef} className="divide-y divide-line py-1">
              {results.map((r, i) => (
                <li key={r.file} data-idx={i}>
                  <button
                    type="button"
                    onClick={() => open(r)}
                    onMouseEnter={() => setSelected(i)}
                    className="block w-full px-5 py-3 text-left"
                    style={{
                      background:
                        i === selected
                          ? "color-mix(in srgb, var(--color-amber) 7%, transparent)"
                          : "transparent",
                    }}
                  >
                    <div className="flex items-baseline gap-3">
                      <span
                        className="font-mono shrink-0 text-[9.5px] uppercase tracking-[0.2em]"
                        style={{
                          color: KIND_COLOR[r.kind] ?? "var(--color-ink-dim)",
                        }}
                      >
                        {KIND_LABEL[r.kind]}
                      </span>
                      <span className="truncate text-[14px] text-ink">{r.title}</span>
                      {r.book_title && r.kind !== "book" && (
                        <span
                          className="font-display truncate text-[12.5px] italic"
                          style={{
                            fontVariationSettings: '"opsz" 14, "wght" 360',
                            color: "var(--color-ink-dim)",
                          }}
                        >
                          {r.book_title}
                        </span>
                      )}
                    </div>
                    <p className="search-snippet mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-soft">
                      <Highlighted text={r.snippet} terms={terms} />
                    </p>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-5 py-6 text-center text-[13px] text-ink-dim">{children}</p>
  );
}

/** Wraps query terms in <mark> without touching the rest of the snippet. */
function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  const pattern = terms
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>,
      )}
    </>
  );
}
