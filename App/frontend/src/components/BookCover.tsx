import { useMemo } from "react";
import type { BookSummary } from "../../../shared/types";
import { coverFor } from "../lib/cover";

interface Props {
  book: BookSummary;
  onOpen: () => void;
}

export function BookCover({ book, onOpen }: Props) {
  const style = useMemo(() => coverFor(book.slug), [book.slug]);

  const completedRatio =
    book.progress.total > 0 ? book.progress.completed / book.progress.total : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative block w-full text-left transition-transform duration-300 will-change-transform"
      style={{ transitionTimingFunction: "var(--ease-smooth)" }}
    >
      {/* Cover face */}
      <div
        className="grain grain-cover relative overflow-hidden rounded-[3px]"
        style={{
          aspectRatio: "2 / 3",
          backgroundColor: style.base,
          color: style.ink,
          boxShadow: "var(--shadow-card)",
          outline: "1px solid rgba(0,0,0,0.35)",
          outlineOffset: "-1px",
          transition: "transform 320ms var(--ease-smooth), box-shadow 320ms var(--ease-smooth)",
        }}
      >
        {/* Spine shadow on the left edge — implies physicality */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[10%]"
          style={{
            background: `linear-gradient(to right, ${style.spine}, transparent)`,
            opacity: 0.85,
          }}
        />
        {/* Top frame line */}
        <div
          className="pointer-events-none absolute inset-x-6 top-6 h-px"
          style={{ background: style.accent, opacity: 0.55 }}
        />
        <div
          className="pointer-events-none absolute inset-x-6 bottom-6 h-px"
          style={{ background: style.accent, opacity: 0.55 }}
        />

        {/* Content */}
        <div className="relative flex h-full flex-col px-6 py-7">
          <div className="mb-auto flex items-center justify-between">
            <div
              className="font-mono text-[10px] tracking-[0.22em]"
              style={{ color: style.accent }}
            >
              VOL · {style.volume}
            </div>
            <StatusSigil status={book.status} accent={style.accent} ink={style.ink} />
          </div>

          <div className="space-y-3">
            <h3
              className="font-display text-[clamp(1.05rem,1.5vw,1.35rem)] leading-[1.1]"
              style={{
                fontVariationSettings: '"opsz" 144, "wght" 460',
                color: style.ink,
                display: "-webkit-box",
                WebkitLineClamp: 4,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {book.title}
            </h3>
            <div
              className="h-px w-8"
              style={{ background: style.accent, opacity: 0.85 }}
            />
            <p
              className="font-display text-[11.5px] italic tracking-wide"
              style={{
                fontVariationSettings: '"opsz" 14, "wght" 350',
                color: style.ink,
                opacity: 0.78,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {book.author}
            </p>
          </div>
        </div>
      </div>

      {/* Caption beneath the cover */}
      <div className="mt-3 flex items-baseline justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-ink-dim">
            {progressLabel(book, completedRatio)}
          </div>
        </div>
        <div className="font-mono text-[11px] text-ink-dim">
          {book.progress.completed}/{book.progress.total || "—"}
        </div>
      </div>

      <style>{`
        .group:hover > div:first-child {
          transform: translateY(-4px);
          box-shadow: var(--shadow-card-hover);
        }
      `}</style>
    </button>
  );
}

function progressLabel(book: BookSummary, ratio: number): string {
  if (book.status === "completed") return "Completed";
  if (book.status === "queued") return "Queued";
  if (ratio === 0) return "Begun";
  return "In progress";
}

function StatusSigil({
  status,
  accent,
  ink,
}: {
  status: BookSummary["status"];
  accent: string;
  ink: string;
}) {
  if (status === "completed") {
    return (
      <div
        className="flex h-5 w-5 items-center justify-center rounded-full"
        style={{
          border: `1px solid ${accent}`,
          background: "rgba(0,0,0,0.35)",
        }}
        aria-label="Completed"
      >
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.2 L5 8.7 L9.5 3.8"
            stroke={accent}
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  }
  if (status === "active") {
    return (
      <div
        className="pulse-soft h-1.5 w-1.5 rounded-full"
        style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
        aria-label="Active"
      />
    );
  }
  return (
    <div
      className="h-px w-4"
      style={{ background: ink, opacity: 0.4 }}
      aria-label="Queued"
    />
  );
}
