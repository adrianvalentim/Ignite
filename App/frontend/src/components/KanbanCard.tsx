import { useMemo, useState } from "react";
import type { BookSummary } from "../../../shared/types";
import { coverFor } from "../lib/cover";
import { daysSince, formatDaysAgo } from "../lib/view";
import { STAGE_LABEL, StageMark } from "./StageMark";

interface Props {
  book: BookSummary;
  onOpen: () => void;
}

export function KanbanCard({ book, onOpen }: Props) {
  const style = useMemo(() => coverFor(book.slug), [book.slug]);
  const last = daysSince(book.progress.last_active);
  const completed = book.progress.completed;
  const total = book.progress.total || book.segments.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const canExpand = book.segments.length > 0 || Object.keys(book.difficulty_map).length > 0;

  // Default: active books open, the rest folded. The user can flip either.
  const [expanded, setExpanded] = useState<boolean>(book.status === "active");

  const hotspots = useMemo(
    () =>
      Object.entries(book.difficulty_map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3),
    [book.difficulty_map],
  );

  return (
    <article
      className="grain grain-paper group relative overflow-hidden rounded-sm border"
      style={{
        background: "var(--color-bg-elev)",
        borderColor: "var(--color-line)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* accent stripe down the left, derived from the cover palette */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-[3px]"
        style={{ background: style.accent, opacity: book.status === "queued" ? 0.4 : 0.85 }}
      />

      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left px-5 py-4 pr-14"
        aria-label={`Open ${book.title}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              className="font-display text-[17px] leading-[1.2]"
              style={{
                fontVariationSettings: '"opsz" 24, "wght" 440',
                color: "var(--color-ink)",
              }}
            >
              {book.title}
            </h3>
            <p
              className="font-display mt-0.5 text-[12.5px] italic"
              style={{
                fontVariationSettings: '"opsz" 14, "wght" 360',
                color: "var(--color-ink-soft)",
              }}
            >
              {book.author}
            </p>
          </div>
        </div>

        {/* Progress strip + counts */}
        <div className="mt-4">
          <div
            className="relative h-[2px] w-full overflow-hidden rounded-full"
            style={{ background: "var(--color-line)" }}
          >
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width: `${pct}%`,
                background: style.accent,
                opacity: book.status === "queued" ? 0.5 : 1,
                transition: "width 600ms var(--ease-smooth)",
              }}
            />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-ink-dim">
            <span>{progressLabel(book, completed, total)}</span>
            <span>{book.status === "queued" ? "—" : formatDaysAgo(last)}</span>
          </div>
        </div>
      </button>

      {/* Right-side cluster: status pip + expand caret, both above the open-card surface */}
      <div className="pointer-events-none absolute right-3 top-4 flex items-center gap-2">
        <Pip status={book.status} accent={style.accent} />
        {canExpand && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            aria-label={expanded ? "Collapse details" : "Expand details"}
            aria-expanded={expanded}
            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full transition-colors"
            style={{
              color: "var(--color-ink-dim)",
              background: "transparent",
            }}
          >
            <Chevron open={expanded} />
          </button>
        )}
      </div>

      <div
        className="grid transition-[grid-template-rows] duration-300"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transitionTimingFunction: "var(--ease-smooth)",
        }}
      >
        <div className="overflow-hidden">
          {expanded && (
            <div className="px-5 pb-5">
              <Pipeline book={book} accent={style.accent} />
              {hotspots.length > 0 && <Hotspots entries={hotspots} />}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      aria-hidden
      style={{
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 220ms var(--ease-smooth)",
      }}
    >
      <path
        d="M2.5 4.25 L6 7.75 L9.5 4.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function progressLabel(book: BookSummary, completed: number, total: number): string {
  if (book.status === "queued") return "Queued";
  if (book.status === "completed") return "Completed";
  if (total === 0) return "Begun";
  return `${completed} of ${total}`;
}

function Pip({ status, accent }: { status: BookSummary["status"]; accent: string }) {
  if (status === "active") {
    return (
      <span
        className="pulse-soft mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: accent, boxShadow: `0 0 10px ${accent}` }}
        aria-label="Active"
      />
    );
  }
  if (status === "completed") {
    return (
      <span
        className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
        style={{ border: `1px solid ${accent}` }}
        aria-label="Completed"
      >
        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.2 L5 8.7 L9.5 3.8"
            stroke={accent}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="mt-2 inline-block h-px w-3 shrink-0"
      style={{ background: "var(--color-ink-dim)", opacity: 0.55 }}
      aria-label="Queued"
    />
  );
}

function Pipeline({ book, accent }: { book: BookSummary; accent: string }) {
  return (
    <div className="mt-5">
      <SectionLabel>Pipeline</SectionLabel>
      <ul className="mt-3 space-y-1.5">
        {book.segments.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-sm px-2 py-1.5"
            style={{
              background:
                s.stage !== "unread" && s.stage !== "complete"
                  ? `color-mix(in srgb, ${accent} 6%, transparent)`
                  : "transparent",
            }}
          >
            <span className="font-mono text-[10px] tabular-nums text-ink-dim w-4">
              {s.id}
            </span>
            <StageMark stage={s.stage} title={STAGE_LABEL[s.stage]} size={14} />
            <span
              className="flex-1 truncate text-[13px]"
              style={{
                color:
                  s.stage === "unread"
                    ? "var(--color-ink-dim)"
                    : "var(--color-ink)",
              }}
            >
              {s.title}
            </span>
            {s.difficulty > 0 && (
              <span
                className="font-mono text-[10px] tabular-nums"
                style={{ color: difficultyColor(s.difficulty) }}
              >
                {s.difficulty.toFixed(1)}
              </span>
            )}
          </li>
        ))}
        {book.segments.length === 0 && (
          <li className="px-2 py-1.5 text-[12.5px] text-ink-soft">
            Run <span className="font-mono text-[11.5px]">setup-book</span> to segment.
          </li>
        )}
      </ul>
    </div>
  );
}

function Hotspots({ entries }: { entries: [string, number][] }) {
  return (
    <div className="mt-5">
      <SectionLabel>Hotspots</SectionLabel>
      <ul className="mt-3 space-y-1">
        {entries.map(([concept, value]) => (
          <li
            key={concept}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2 text-[12.5px] text-ink-soft truncate">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                style={{ background: difficultyColor(value) }}
              />
              {concept}
            </span>
            <span className="font-mono text-[10.5px] tabular-nums text-ink-dim">
              {value.toFixed(1)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-ink-dim">
      {children}
    </div>
  );
}

function difficultyColor(value: number): string {
  if (value >= 0.7) return "var(--color-rust)";
  if (value >= 0.4) return "var(--color-amber)";
  return "var(--color-green)";
}
