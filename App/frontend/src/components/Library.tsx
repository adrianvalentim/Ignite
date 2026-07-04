import { useMemo, useState } from "react";
import type { BookStatus, BookSummary } from "../../../shared/types";
import { BookCover } from "./BookCover";

type Filter = "all" | BookStatus;

interface Props {
  books: BookSummary[];
  onOpen: (slug: string) => void;
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "completed", label: "Completed" },
  { id: "queued", label: "Queued" },
];

export function Library({ books, onOpen }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: books.length, active: 0, completed: 0, queued: 0 };
    for (const b of books) c[b.status]++;
    return c;
  }, [books]);

  const visible = useMemo(() => {
    const list = filter === "all" ? books : books.filter((b) => b.status === filter);
    // Active first, then queued, then completed. Within each, alpha.
    const rank: Record<BookStatus, number> = { active: 0, queued: 1, completed: 2 };
    return [...list].sort((a, b) =>
      rank[a.status] === rank[b.status]
        ? a.title.localeCompare(b.title)
        : rank[a.status] - rank[b.status],
    );
  }, [books, filter]);

  return (
    <div className="fade-rise mx-auto w-full max-w-7xl px-8 pt-20 pb-14 sm:px-12 sm:pt-24">
      <header className="mb-12 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-ink-dim">
            Effortful Learning
          </div>
          <h1
            className="font-display mt-2 text-[clamp(2.2rem,4vw,3.4rem)] leading-[1.02] text-ink"
            style={{ fontVariationSettings: '"opsz" 144, "wght" 380, "SOFT" 60' }}
          >
            The Library
          </h1>
          <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-ink-soft">
            {visible.length === 0
              ? "Nothing on the shelves yet. Add a book to begin."
              : `${counts.active} active · ${counts.completed} completed · ${counts.queued} queued.`}
          </p>
        </div>

        <nav className="flex items-center gap-1 self-start sm:self-end">
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="group relative rounded-sm px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.22em] transition-colors"
                style={{
                  color: active ? "var(--color-amber)" : "var(--color-ink-dim)",
                }}
              >
                <span>{f.label}</span>
                <span className="ml-1.5 text-[10px] opacity-60">
                  {counts[f.id]}
                </span>
                <span
                  className="absolute -bottom-1 left-2 right-2 h-px"
                  style={{
                    background: active ? "var(--color-amber)" : "transparent",
                    opacity: active ? 0.7 : 0,
                    transition: "opacity 200ms var(--ease-smooth)",
                  }}
                />
              </button>
            );
          })}
        </nav>
      </header>

      {visible.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-x-7 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((book) => (
            <BookCover key={book.slug} book={book} onOpen={() => onOpen(book.slug)} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="grain mx-auto mt-10 max-w-xl rounded-sm border border-line-strong px-10 py-14 text-center"
      style={{ background: "var(--color-bg-elev)" }}
    >
      <div className="font-display text-2xl text-ink" style={{ fontVariationSettings: '"opsz" 144, "wght" 380' }}>
        An empty shelf.
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
        Books appear here once they are added to{" "}
        <span className="font-mono text-[12.5px] text-ink-dim">Learning/books/</span>.
        Use the <span className="font-mono text-[12.5px] text-ink-dim">setup-book</span>{" "}
        prompt in your editor to begin.
      </p>
    </div>
  );
}
