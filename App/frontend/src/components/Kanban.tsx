import { useMemo } from "react";
import type { BookStatus, BookSummary } from "../../../shared/types";
import { KanbanCard } from "./KanbanCard";

interface Props {
  books: BookSummary[];
  onOpen: (slug: string) => void;
}

const COLUMNS: { id: BookStatus; label: string; subtitle: string }[] = [
  { id: "queued", label: "Queued", subtitle: "Waiting" },
  { id: "active", label: "Active", subtitle: "In motion" },
  { id: "completed", label: "Completed", subtitle: "On the shelf" },
];

export function Kanban({ books, onOpen }: Props) {
  const grouped = useMemo(() => {
    const out: Record<BookStatus, BookSummary[]> = {
      queued: [],
      active: [],
      completed: [],
    };
    for (const b of books) out[b.status].push(b);
    // Within a column, order: active by recency desc, queued alpha, completed by completion desc
    out.active.sort((a, b) =>
      (b.progress.last_active ?? "").localeCompare(a.progress.last_active ?? ""),
    );
    out.queued.sort((a, b) => a.title.localeCompare(b.title));
    out.completed.sort((a, b) =>
      (b.date_completed ?? "").localeCompare(a.date_completed ?? ""),
    );
    return out;
  }, [books]);

  return (
    <div className="fade-rise mx-auto w-full max-w-7xl px-8 pt-20 pb-14 sm:px-12 sm:pt-24">
      <header className="mb-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-ink-dim">
          Effortful Learning
        </div>
        <h1
          className="font-display mt-2 text-[clamp(2.2rem,4vw,3.4rem)] leading-[1.02] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 380, "SOFT" 60' }}
        >
          The Board
        </h1>
        <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-ink-soft">
          {summarySentence(grouped)}
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <Column
            key={col.id}
            label={col.label}
            subtitle={col.subtitle}
            count={grouped[col.id].length}
          >
            {grouped[col.id].length === 0 ? (
              <EmptyColumn label={col.label} />
            ) : (
              grouped[col.id].map((book) => (
                <KanbanCard
                  key={book.slug}
                  book={book}
                  onOpen={() => onOpen(book.slug)}
                />
              ))
            )}
          </Column>
        ))}
      </div>
    </div>
  );
}

function summarySentence(grouped: Record<BookStatus, BookSummary[]>): string {
  const a = grouped.active.length;
  const q = grouped.queued.length;
  const c = grouped.completed.length;
  if (a + q + c === 0) return "The board is empty.";
  const parts: string[] = [];
  if (a) parts.push(`${a} in motion`);
  if (q) parts.push(`${q} in the queue`);
  if (c) parts.push(`${c} on the shelf`);
  return parts.join(" · ") + ".";
}

function Column({
  label,
  subtitle,
  count,
  children,
}: {
  label: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <header
        className="flex items-baseline justify-between border-b pb-3"
        style={{ borderColor: "var(--color-line-strong)" }}
      >
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.28em] text-ink">
            {label}
            <span className="ml-2 text-ink-dim">{count}</span>
          </h2>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim">
            {subtitle}
          </p>
        </div>
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function EmptyColumn({ label }: { label: string }) {
  return (
    <div
      className="rounded-sm border border-dashed px-4 py-8 text-center font-mono text-[10.5px] uppercase tracking-[0.22em]"
      style={{
        borderColor: "var(--color-line)",
        color: "var(--color-ink-dim)",
      }}
    >
      Nothing {label.toLowerCase()}.
    </div>
  );
}
