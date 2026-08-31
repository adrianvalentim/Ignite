import type { PipelineItem, ReviewItem, TodayPayload } from "../../../shared/types";
import { daysSince, formatDaysAgo } from "../lib/view";
import { STAGE_LABEL, StageMark } from "./StageMark";

interface Props {
  today: TodayPayload;
  onOpen: (slug: string) => void;
}

const SUGGESTED_LABEL: Record<string, string> = {
  recall: "Free recall",
  interrogation: "Interrogate",
  reconstruction: "Reconstruct",
};

export function Today({ today, onOpen }: Props) {
  const { due, upcoming, pipeline, stats } = today;

  const subtitle =
    due.length === 0 && pipeline.length === 0
      ? "Nothing is waiting. Read something."
      : [
          due.length > 0 &&
            `${due.length} ${due.length === 1 ? "memory" : "memories"} due for review`,
          pipeline.length > 0 &&
            `${pipeline.length} pipeline ${pipeline.length === 1 ? "move" : "moves"}`,
        ]
          .filter(Boolean)
          .join(" · ") + ".";

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
          The Desk
        </h1>
        <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-ink-soft">
          {subtitle}
        </p>
      </header>

      <StatsFrieze stats={stats} />

      <Section
        title="Due for review"
        subtitle="Memory fades on schedule."
        count={due.length}
      >
        {due.length === 0 ? (
          <QuietNote>
            Nothing is due. Reviews appear here once interrogated segments age
            past their interval.
          </QuietNote>
        ) : (
          <ul className="divide-y divide-line">
            {due.map((item) => (
              <ReviewRow
                key={`${item.book}/${item.segment.id}`}
                item={item}
                onOpen={() => onOpen(item.book)}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="Continue the pipeline"
        subtitle="The next move per book."
        count={pipeline.length}
      >
        {pipeline.length === 0 ? (
          <QuietNote>Every active book is fully metabolised.</QuietNote>
        ) : (
          <ul className="divide-y divide-line">
            {pipeline.map((item) => (
              <PipelineRow
                key={item.book}
                item={item}
                onOpen={() => onOpen(item.book)}
              />
            ))}
          </ul>
        )}
      </Section>

      {upcoming.length > 0 && (
        <Section
          title="On the horizon"
          subtitle="Coming due within a week."
          count={upcoming.length}
        >
          <ul className="space-y-2">
            {upcoming.map((item) => (
              <li key={`${item.book}/${item.segment.id}`}>
                <button
                  type="button"
                  onClick={() => onOpen(item.book)}
                  className="flex w-full items-baseline gap-3 text-left"
                >
                  <span className="font-mono text-[11px] tabular-nums text-ink-dim w-24 shrink-0">
                    {item.next_review}
                  </span>
                  <span className="truncate text-[13.5px] text-ink-soft">
                    {item.book_title}
                    <span className="text-ink-dim"> · {item.segment.title}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function StatsFrieze({ stats }: { stats: TodayPayload["stats"] }) {
  const items: { value: string; label: string; accent?: boolean }[] = [
    {
      value: String(stats.due_count),
      label: "Due for review",
      accent: stats.due_count > 0,
    },
    { value: String(stats.sessions_7d), label: "Sessions this week" },
    { value: formatMinutes(stats.minutes_7d), label: "Effort this week" },
    {
      value:
        stats.streak_days === 0 ? "—" : `${stats.streak_days}d`,
      label: "Streak",
    },
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
              className="font-display leading-none"
              style={{
                fontVariationSettings: '"opsz" 144, "wght" 360',
                fontSize: "clamp(1.9rem, 3.4vw, 2.6rem)",
                color: it.accent ? "var(--color-amber)" : "var(--color-ink)",
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

function formatMinutes(mins: number): string {
  if (mins <= 0) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function ReviewRow({ item, onOpen }: { item: ReviewItem; onOpen: () => void }) {
  const seg = item.segment;
  const last = daysSince(item.last_touched);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-5 py-4 text-left"
      >
        <StageMark stage={seg.stage} title={STAGE_LABEL[seg.stage]} size={18} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] text-ink">
            {seg.title}
            <span
              className="font-display ml-2 text-[13.5px] italic"
              style={{
                fontVariationSettings: '"opsz" 14, "wght" 360',
                color: "var(--color-ink-soft)",
              }}
            >
              {item.book_title}
            </span>
          </div>
          <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-dim">
            Last touched {formatDaysAgo(last).toLowerCase()}
            <span className="mx-2 opacity-50">·</span>
            {item.retrieval_count}{" "}
            {item.retrieval_count === 1 ? "retrieval" : "retrievals"}
            <span className="mx-2 opacity-50">·</span>
            interval {item.interval_days}d
          </div>
        </div>
        <OverdueChip days={item.days_overdue} />
        <ActionChip>{SUGGESTED_LABEL[item.suggested] ?? item.suggested}</ActionChip>
      </button>
    </li>
  );
}

function PipelineRow({ item, onOpen }: { item: PipelineItem; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="group flex w-full items-center gap-5 py-4 text-left"
      >
        {item.segment ? (
          <StageMark
            stage={item.segment.stage}
            title={STAGE_LABEL[item.segment.stage]}
            size={18}
          />
        ) : (
          <span
            className="inline-block h-[18px] w-[18px] shrink-0 rounded-full border"
            style={{ borderColor: "var(--color-ink-dim)", opacity: 0.5 }}
            aria-hidden
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] text-ink">
            {item.segment ? item.segment.title : item.book_title}
            {item.segment && (
              <span
                className="font-display ml-2 text-[13.5px] italic"
                style={{
                  fontVariationSettings: '"opsz" 14, "wght" 360',
                  color: "var(--color-ink-soft)",
                }}
              >
                {item.book_title}
              </span>
            )}
          </div>
          {item.prompt && (
            <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-dim">
              prompt: {item.prompt}
            </div>
          )}
        </div>
        <ActionChip>{item.action}</ActionChip>
      </button>
    </li>
  );
}

function OverdueChip({ days }: { days: number }) {
  const label = days === 0 ? "Due today" : `${days}d overdue`;
  const color = days >= 14 ? "var(--color-rust)" : "var(--color-amber)";
  return (
    <span
      className="font-mono shrink-0 rounded-sm border px-2 py-1 text-[10px] uppercase tracking-[0.18em]"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 8%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}

function ActionChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono hidden shrink-0 rounded-sm border px-2 py-1 text-[10px] uppercase tracking-[0.18em] sm:inline"
      style={{
        color: "var(--color-ink-soft)",
        borderColor: "var(--color-line-strong)",
      }}
    >
      {children}
    </span>
  );
}

function Section({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <header className="mb-4 flex items-baseline gap-4">
        <h2
          className="font-display text-[20px] text-ink"
          style={{ fontVariationSettings: '"opsz" 24, "wght" 420' }}
        >
          {title}
        </h2>
        <div className="h-px flex-1" style={{ background: "var(--color-line-strong)" }} />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim">
          {count > 0 ? count : subtitle}
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
