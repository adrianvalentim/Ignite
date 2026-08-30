import { useMemo } from "react";
import type { BookSummary, SessionLog } from "../../../shared/types";

interface Props {
  books: BookSummary[];
  logs: SessionLog[];
  onOpen: (slug: string) => void;
  onOpenLog: (book: string, file: string) => void;
}

const TYPE_LABEL: Record<string, string> = {
  interrogation: "Interrogation",
  "reconstruction-review": "Reconstruction Review",
  cards: "Card Generation",
  feynman: "Feynman Test",
  examination: "Final Examination",
};

const TYPE_COLOR: Record<string, string> = {
  interrogation: "var(--color-slate-blue)",
  "reconstruction-review": "var(--color-amber)",
  cards: "var(--color-amber)",
  feynman: "var(--color-ink-soft)",
  examination: "var(--color-green)",
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthGroup {
  key: string;
  label: string;
  entries: SessionLog[];
}

function groupByMonth(logs: SessionLog[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const log of logs) {
    if (!log.date || log.date.length < 7) continue;
    const key = log.date.slice(0, 7);
    if (!groups.length || groups[groups.length - 1].key !== key) {
      const [y, m] = key.split("-");
      const monthIdx = Number(m) - 1;
      groups.push({
        key,
        label: `${MONTH_NAMES[monthIdx] ?? m} ${y}`,
        entries: [log],
      });
    } else {
      groups[groups.length - 1].entries.push(log);
    }
  }
  return groups;
}

interface Stats {
  books_completed: number;
  segments_processed: number;
  sessions_logged: number;
  threads_drawn: number;
}

function computeStats(books: BookSummary[], logs: SessionLog[]): Stats {
  let segs = 0;
  let threads = 0;
  for (const b of books) {
    for (const s of b.segments) if (s.stage === "complete") segs++;
    threads += b.connections.length;
  }
  return {
    books_completed: books.filter((b) => b.status === "completed").length,
    segments_processed: segs,
    sessions_logged: logs.length,
    threads_drawn: threads,
  };
}

export function Timeline({ books, logs, onOpen, onOpenLog }: Props) {
  const bookBySlug = useMemo(() => {
    const m: Record<string, BookSummary> = {};
    for (const b of books) m[b.slug] = b;
    return m;
  }, [books]);

  const groups = useMemo(() => groupByMonth(logs), [logs]);
  const stats = useMemo(() => computeStats(books, logs), [books, logs]);

  return (
    <div className="fade-rise mx-auto w-full max-w-3xl px-8 pt-20 pb-14 sm:px-12 sm:pt-24">
      <header className="mb-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-ink-dim">
          Effortful Learning
        </div>
        <h1
          className="font-display mt-2 text-[clamp(2.2rem,4vw,3.4rem)] leading-[1.02] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 380, "SOFT" 60' }}
        >
          The Chronicle
        </h1>
      </header>

      <StatsFrieze stats={stats} />

      {groups.length === 0 ? (
        <EmptyChronicle />
      ) : (
        <div className="mt-14 space-y-14">
          {groups.map((group) => (
            <MonthSection
              key={group.key}
              group={group}
              bookBySlug={bookBySlug}
              onOpen={onOpen}
              onOpenLog={onOpenLog}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatsFrieze({ stats }: { stats: Stats }) {
  const items: { value: number; label: string }[] = [
    { value: stats.books_completed, label: "Books on the shelf" },
    { value: stats.segments_processed, label: "Segments metabolised" },
    { value: stats.sessions_logged, label: "Sessions logged" },
    { value: stats.threads_drawn, label: "Threads drawn" },
  ];
  return (
    <div
      className="grain grain-paper relative rounded-sm border px-2 py-7 sm:px-6"
      style={{
        background: "var(--color-bg-elev)",
        borderColor: "var(--color-line-strong)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div className="grid grid-cols-2 gap-y-7 sm:grid-cols-4 sm:gap-y-0">
        {items.map((it, i) => (
          <div
            key={it.label}
            className="px-4 text-center"
            style={{
              borderLeft:
                i > 0
                  ? "1px solid color-mix(in srgb, var(--color-line-strong) 80%, transparent)"
                  : "none",
            }}
          >
            <div
              className="font-display leading-none text-ink"
              style={{
                fontVariationSettings: '"opsz" 144, "wght" 360',
                fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)",
              }}
            >
              {it.value}
            </div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim">
              {it.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthSection({
  group,
  bookBySlug,
  onOpen,
  onOpenLog,
}: {
  group: MonthGroup;
  bookBySlug: Record<string, BookSummary>;
  onOpen: (slug: string) => void;
  onOpenLog: (book: string, file: string) => void;
}) {
  return (
    <section>
      <div className="mb-6 flex items-baseline gap-4">
        <h2
          className="font-display text-[18px]"
          style={{
            fontVariationSettings: '"opsz" 36, "wght" 420',
            color: "var(--color-ink)",
          }}
        >
          {group.label}
        </h2>
        <div
          className="h-px flex-1"
          style={{ background: "var(--color-line-strong)" }}
        />
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim">
          {group.entries.length}{" "}
          {group.entries.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      <ol className="space-y-0">
        {group.entries.map((log, i) => (
          <TimelineEntry
            key={log.path}
            log={log}
            book={bookBySlug[log.book]}
            isLast={i === group.entries.length - 1}
            onOpen={() => onOpen(log.book)}
            onOpenLog={onOpenLog}
          />
        ))}
      </ol>
    </section>
  );
}

function TimelineEntry({
  log,
  book,
  isLast,
  onOpen,
  onOpenLog,
}: {
  log: SessionLog;
  book: BookSummary | undefined;
  isLast: boolean;
  onOpen: () => void;
  onOpenLog: (book: string, file: string) => void;
}) {
  const logFile = log.path.split("/").pop();
  const typeColor = TYPE_COLOR[log.type] ?? "var(--color-ink-soft)";
  const typeLabel = TYPE_LABEL[log.type] ?? capitalise(log.type);
  const day = formatDay(log.date);
  const segmentTitle = book && log.segment
    ? findSegmentTitle(book, log.segment)
    : null;

  return (
    <li className="relative flex gap-5 pb-9 last:pb-2">
      <div className="relative flex w-3 shrink-0 flex-col items-center pt-1.5">
        <span
          className="relative z-10 h-2.5 w-2.5 rounded-full"
          style={{
            background: typeColor,
            boxShadow: `0 0 0 3px var(--color-bg)`,
          }}
        />
        {!isLast && (
          <span
            className="mt-1 w-px flex-1"
            style={{ background: "var(--color-line-strong)" }}
          />
        )}
      </div>

      <div className="min-w-0 flex-1 -mt-0.5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-dim">
          <span style={{ color: "var(--color-ink)" }}>{day}</span>
          <span className="mx-2 opacity-50">·</span>
          <span style={{ color: typeColor }}>{typeLabel}</span>
          {log.segment && (
            <>
              <span className="mx-2 opacity-50">·</span>
              <span>{formatSegmentRef(log.segment)}</span>
            </>
          )}
          {log.duration_approx && (
            <>
              <span className="mx-2 opacity-50">·</span>
              <span>{log.duration_approx}</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="mt-1.5 block text-left"
        >
          <span
            className="font-display text-[16px] leading-snug"
            style={{
              fontVariationSettings: '"opsz" 24, "wght" 430',
              color: "var(--color-ink)",
            }}
          >
            {book?.title ?? log.book}
          </span>
          {segmentTitle && (
            <span
              className="font-display ml-2 text-[14px] italic"
              style={{
                fontVariationSettings: '"opsz" 14, "wght" 360',
                color: "var(--color-ink-soft)",
              }}
            >
              · {segmentTitle}
            </span>
          )}
        </button>

        {log.summary && (
          <p
            className="mt-2 text-[13.5px] leading-relaxed"
            style={{ color: "var(--color-ink-soft)" }}
          >
            {cleanSummary(log.summary)}
          </p>
        )}

        {logFile && (
          <button
            type="button"
            onClick={() => onOpenLog(log.book, logFile)}
            className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.22em] transition-colors"
            style={{ color: "var(--color-ink-dim)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-amber)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-ink-dim)")}
          >
            Read the log →
          </button>
        )}
      </div>
    </li>
  );
}

function findSegmentTitle(book: BookSummary, segRef: string): string | null {
  // segRef may be "03-identification" or "identification" or "03"
  for (const s of book.segments) {
    if (segRef === `${s.id}-${s.slug}` || segRef === s.slug || segRef === s.id) {
      return s.title;
    }
  }
  return null;
}

function formatDay(iso: string): string {
  if (!iso || iso.length < 10) return iso;
  const [, m, d] = iso.split("-");
  return `${MONTH_NAMES[Number(m) - 1]?.slice(0, 3) ?? m} ${Number(d)}`;
}

function capitalise(s: string): string {
  return s.replace(/(^|[\s-])\w/g, (c) => c.toUpperCase()).replace(/-/g, " ");
}

function cleanSummary(s: string): string {
  // Strip the first markdown heading (usually "## Summary") and then
  // take only the first paragraph — anything past another heading or
  // a paragraph break would belong to a separate log section.
  const noHead = s.replace(/^#{1,6}\s+[^\n]+\n+/g, "").trim();
  const firstPara =
    noHead.split(/\n\s*\n|\n#{1,6}\s/)[0]?.trim() ?? "";
  return firstPara.slice(0, 320);
}

function formatSegmentRef(ref: string): string {
  // Numeric ID prefixes ("03-identification") read as "Seg 03".
  // Anything else ("final") is shown as a capitalised word so the chip
  // doesn't say "Seg final".
  const head = ref.split("-")[0] ?? ref;
  if (/^\d+$/.test(head)) return `Seg ${head}`;
  return head.charAt(0).toUpperCase() + head.slice(1);
}

function EmptyChronicle() {
  return (
    <div
      className="grain mt-12 rounded-sm border border-line-strong px-10 py-14 text-center"
      style={{ background: "var(--color-bg-elev)" }}
    >
      <div
        className="font-display text-2xl text-ink"
        style={{ fontVariationSettings: '"opsz" 144, "wght" 380' }}
      >
        The page is blank.
      </div>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
        Session logs appear here once your AI begins recording them, after
        an interrogation, a reconstruction, or a final examination.
      </p>
    </div>
  );
}
