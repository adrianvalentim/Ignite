import { useMemo } from "react";
import type {
  BookSummary,
  RetentionPoint,
  SegmentStage,
  StatsPayload,
} from "../../../shared/types";
import { coverFor } from "../lib/cover";
import { STAGE_LABEL } from "./StageMark";

interface Props {
  stats: StatsPayload;
  books: BookSummary[];
  onOpen: (slug: string) => void;
}

const STAGE_ORDER: SegmentStage[] = [
  "unread",
  "read",
  "interrogated",
  "reconstructed",
  "carded",
  "complete",
];

const STAGE_COLOR: Record<SegmentStage, string> = {
  unread: "var(--color-ink-dim)",
  read: "var(--color-ink-soft)",
  interrogated: "var(--color-slate-blue)",
  reconstructed: "var(--color-amber)",
  carded: "var(--color-amber)",
  complete: "var(--stage-complete)",
};

export function Stats({ stats, books, onOpen }: Props) {
  return (
    <div className="fade-rise mx-auto w-full max-w-3xl px-8 pt-20 pb-14 sm:px-12 sm:pt-24">
      <header className="mb-10">
        <div className="font-mono text-[11px] uppercase tracking-[0.32em] text-ink-dim">
          Ignite
        </div>
        <h1
          className="font-display mt-2 text-[clamp(2.2rem,4vw,3.4rem)] leading-[1.02] text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 380, "SOFT" 60' }}
        >
          The Ledger
        </h1>
      </header>

      <TotalsFrieze totals={stats.totals} />

      <Section title="Effort" subtitle={effortRange(stats.weeks)}>
        <EffortChart weeks={stats.weeks} />
      </Section>

      <Section title="Retention" subtitle="Recall quality per session">
        {stats.retention.length === 0 ? (
          <QuietNote>
            No measured outcomes yet. When a session log records an{" "}
            <span className="font-mono text-[12px]">outcomes:</span> map in its
            frontmatter, recall quality lands here.
          </QuietNote>
        ) : (
          <RetentionChart points={stats.retention} books={books} />
        )}
      </Section>

      <Section title="The pipeline" subtitle="Every segment, by stage">
        <StageBar counts={stats.stage_counts} />
      </Section>

      <Section title="Difficulty" subtitle="Where the friction lives">
        <DifficultyLedger books={books} onOpen={onOpen} />
      </Section>
    </div>
  );
}

function TotalsFrieze({ totals }: { totals: StatsPayload["totals"] }) {
  const items = [
    { value: String(totals.sessions), label: "Sessions logged" },
    { value: formatHours(totals.minutes), label: "Recorded effort" },
    { value: String(totals.books), label: "Books" },
    { value: String(totals.segments_complete), label: "Segments complete" },
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

function effortRange(weeks: StatsPayload["weeks"]): string {
  if (weeks.length === 0) return "16 weeks";
  return `${weeks.length} weeks from ${weeks[0].week_start}`;
}

function formatHours(mins: number): string {
  if (mins <= 0) return "—";
  if (mins < 60) return `${mins}m`;
  const h = mins / 60;
  return `${h % 1 === 0 ? h : h.toFixed(1)}h`;
}

// ---------------------------------------------------------------------------
// Effort: one bar per week. Height follows minutes when durations were
// recorded, otherwise session counts, so the chart degrades gracefully.

function EffortChart({ weeks }: { weeks: StatsPayload["weeks"] }) {
  const useMinutes = weeks.some((w) => w.minutes > 0);
  const values = weeks.map((w) => (useMinutes ? w.minutes : w.sessions));
  const max = Math.max(1, ...values);

  const W = 640;
  const H = 150;
  const PAD_BOTTOM = 22;
  const gap = 6;
  const barW = (W - gap * (weeks.length - 1)) / weeks.length;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Weekly effort">
        <line
          x1="0"
          y1={H - PAD_BOTTOM + 0.5}
          x2={W}
          y2={H - PAD_BOTTOM + 0.5}
          stroke="var(--color-line-strong)"
          strokeWidth="1"
        />
        {weeks.map((w, i) => {
          const v = values[i];
          const h = v === 0 ? 2 : Math.max(3, (v / max) * (H - PAD_BOTTOM - 14));
          const x = i * (barW + gap);
          const y = H - PAD_BOTTOM - h;
          const label = monthDay(w.week_start);
          return (
            <g key={w.week_start}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx="1.5"
                fill={v === 0 ? "var(--color-line-strong)" : "var(--color-amber)"}
                opacity={v === 0 ? 0.6 : 0.35 + 0.65 * (v / max)}
              >
                <title>
                  {`Week of ${w.week_start}: ${w.sessions} session${w.sessions === 1 ? "" : "s"}${w.minutes > 0 ? ` · ${w.minutes}m` : ""}`}
                </title>
              </rect>
              {i % 4 === 0 && (
                <text
                  x={x + barW / 2}
                  y={H - 6}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--color-ink-dim)"
                  fontFamily="var(--font-mono)"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim">
        {useMinutes ? "Minutes per week" : "Sessions per week"}
      </div>
    </div>
  );
}

function monthDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

// ---------------------------------------------------------------------------
// Retention: each measured session is a dot; a thread connects the running
// picture per book. 0.5 is drawn as the "shaky" line.

function RetentionChart({
  points,
  books,
}: {
  points: RetentionPoint[];
  books: BookSummary[];
}) {
  const W = 640;
  const H = 190;
  const PAD = { top: 10, right: 12, bottom: 24, left: 38 };

  const accentFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of books) m.set(b.slug, coverFor(b.slug).accent);
    return (slug: string) => m.get(slug) ?? "var(--color-ink-soft)";
  }, [books]);

  const titleFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of books) m.set(b.slug, b.title);
    return (slug: string) => m.get(slug) ?? slug;
  }, [books]);

  const days = points.map((p) => Date.parse(p.date));
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);
  const span = Math.max(1, maxDay - minDay);

  const x = (p: RetentionPoint) =>
    PAD.left +
    ((Date.parse(p.date) - minDay) / span) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - v) * (H - PAD.top - PAD.bottom);

  const byBook = useMemo(() => {
    const m = new Map<string, RetentionPoint[]>();
    for (const p of points) {
      const list = m.get(p.book) ?? [];
      list.push(p);
      m.set(p.book, list);
    }
    return m;
  }, [points]);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Retention over time">
        {[1, 0.5, 0].map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              y1={y(v)}
              x2={W - PAD.right}
              y2={y(v)}
              stroke="var(--color-line-strong)"
              strokeWidth="1"
              strokeDasharray={v === 0.5 ? "3 4" : undefined}
              opacity={v === 0.5 ? 0.8 : 0.5}
            />
            <text
              x={PAD.left - 8}
              y={y(v) + 3}
              textAnchor="end"
              fontSize="9.5"
              fill="var(--color-ink-dim)"
              fontFamily="var(--font-mono)"
            >
              {Math.round(v * 100)}%
            </text>
          </g>
        ))}

        {[...byBook.entries()].map(([slug, pts]) => (
          <g key={slug}>
            {pts.length > 1 && (
              <polyline
                points={pts.map((p) => `${x(p)},${y(p.value)}`).join(" ")}
                fill="none"
                stroke={accentFor(slug)}
                strokeWidth="1.3"
                opacity="0.55"
              />
            )}
            {pts.map((p, i) => (
              <circle
                key={`${p.date}-${i}`}
                cx={x(p)}
                cy={y(p.value)}
                r="4"
                fill={accentFor(slug)}
                stroke="var(--color-bg-elev)"
                strokeWidth="1.5"
              >
                <title>
                  {`${p.date} · ${titleFor(p.book)}${p.segment ? ` · ${p.segment}` : ""}: ${Math.round(p.value * 100)}% across ${p.concepts} concept${p.concepts === 1 ? "" : "s"}`}
                </title>
              </circle>
            ))}
          </g>
        ))}

        <text
          x={PAD.left}
          y={H - 6}
          fontSize="9.5"
          fill="var(--color-ink-dim)"
          fontFamily="var(--font-mono)"
        >
          {points[0]?.date}
        </text>
        <text
          x={W - PAD.right}
          y={H - 6}
          textAnchor="end"
          fontSize="9.5"
          fill="var(--color-ink-dim)"
          fontFamily="var(--font-mono)"
        >
          {points[points.length - 1]?.date}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
        {[...byBook.keys()].map((slug) => (
          <span
            key={slug}
            className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-dim"
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: accentFor(slug) }}
            />
            {titleFor(slug)}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage distribution: one bar, six colours.

function StageBar({ counts }: { counts: Record<SegmentStage, number> }) {
  const total = STAGE_ORDER.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  if (total === 0) {
    return <QuietNote>No segments yet.</QuietNote>;
  }
  return (
    <div>
      <div
        className="flex h-3 w-full overflow-hidden rounded-sm border"
        style={{ borderColor: "var(--color-line-strong)" }}
      >
        {STAGE_ORDER.map((s) => {
          const n = counts[s] ?? 0;
          if (n === 0) return null;
          return (
            <div
              key={s}
              title={`${STAGE_LABEL[s]}: ${n}`}
              style={{
                width: `${(n / total) * 100}%`,
                background: STAGE_COLOR[s],
                opacity: s === "unread" ? 0.5 : 0.9,
              }}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {STAGE_ORDER.map((s) => {
          const n = counts[s] ?? 0;
          if (n === 0) return null;
          return (
            <span
              key={s}
              className="inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-dim"
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ background: STAGE_COLOR[s] }}
              />
              {STAGE_LABEL[s]}
              <span className="tabular-nums text-ink-soft">{n}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Difficulty ledger: one row per book, one cell per segment.

function DifficultyLedger({
  books,
  onOpen,
}: {
  books: BookSummary[];
  onOpen: (slug: string) => void;
}) {
  const withSegments = books.filter((b) => b.segments.length > 0);
  if (withSegments.length === 0) {
    return <QuietNote>No segmented books yet.</QuietNote>;
  }
  return (
    <ul className="space-y-5">
      {withSegments.map((book) => (
        <li key={book.slug}>
          <button
            type="button"
            onClick={() => onOpen(book.slug)}
            className="mb-2 block text-left font-display text-[15px] text-ink"
            style={{ fontVariationSettings: '"opsz" 24, "wght" 430' }}
          >
            {book.title}
          </button>
          <div className="flex flex-wrap gap-1.5">
            {book.segments.map((seg) => (
              <div
                key={seg.id}
                title={`${seg.id} · ${seg.title} — ${STAGE_LABEL[seg.stage]}${seg.difficulty > 0 ? ` · difficulty ${seg.difficulty.toFixed(1)}` : ""}`}
                className="flex h-8 w-8 items-center justify-center rounded-sm border font-mono text-[10px] tabular-nums"
                style={{
                  borderColor: "var(--color-line-strong)",
                  background:
                    seg.difficulty > 0
                      ? `color-mix(in srgb, ${difficultyColor(seg.difficulty)} ${20 + seg.difficulty * 55}%, transparent)`
                      : "transparent",
                  color:
                    seg.stage === "unread"
                      ? "var(--color-ink-dim)"
                      : "var(--color-ink)",
                  opacity: seg.stage === "unread" ? 0.6 : 1,
                }}
              >
                {seg.id}
              </div>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

function difficultyColor(value: number): string {
  if (value >= 0.7) return "var(--color-rust)";
  if (value >= 0.4) return "var(--color-amber)";
  return "var(--color-green)";
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <header className="mb-5 flex items-baseline gap-4">
        <h2
          className="font-display text-[20px] text-ink"
          style={{ fontVariationSettings: '"opsz" 24, "wght" 420' }}
        >
          {title}
        </h2>
        <div className="h-px flex-1" style={{ background: "var(--color-line-strong)" }} />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim">
          {subtitle}
        </span>
      </header>
      {children}
    </section>
  );
}

function QuietNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-3 text-[13.5px] leading-relaxed text-ink-dim">{children}</p>
  );
}
