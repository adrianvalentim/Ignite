import { useEffect, useState } from "react";
import type { BookDetail as BookDetailT, SegmentStage } from "../../../shared/types";
import { api } from "../lib/api";
import { coverFor } from "../lib/cover";
import { STAGE_LABEL, StageMark } from "./StageMark";
import { SegmentExpansion } from "./SegmentExpansion";

interface Props {
  slug: string;
  onClose: () => void;
  onOpenLog: (book: string, file: string) => void;
}

export function BookDetail({ slug, onClose, onOpenLog }: Props) {
  const [book, setBook] = useState<BookDetailT | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .book(slug)
      .then((b) => !cancelled && setBook(b))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        style={{ background: "var(--backdrop)", backdropFilter: "blur(2px)" }}
      />
      <aside
        className="fade-rise relative ml-auto h-full w-full max-w-4xl overflow-y-auto border-l border-line-strong"
        style={{ background: "var(--color-bg-elev)" }}
      >
        {!book && !error && <Loading />}
        {error && <ErrorState message={error} />}
        {book && <BookBody book={book} onClose={onClose} onOpenLog={onOpenLog} />}
      </aside>
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-dim">
        Opening…
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="p-16 text-ink-soft">
      <h2 className="font-display text-2xl text-ink">Could not open the book.</h2>
      <p className="mt-3 font-mono text-[12px] text-ink-dim">{message}</p>
    </div>
  );
}

function BookBody({
  book,
  onClose,
  onOpenLog,
}: {
  book: BookDetailT;
  onClose: () => void;
  onOpenLog: (book: string, file: string) => void;
}) {
  const style = coverFor(book.slug);
  const completed = book.progress.completed;
  const total = book.progress.total || book.segments.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Open the first non-complete segment by default so the panel
  // immediately answers "where am I?"
  const initialOpen = (() => {
    const first = book.segments.find((s) => s.stage !== "complete");
    return first?.id ?? null;
  })();
  const [expandedSegment, setExpandedSegment] = useState<string | null>(initialOpen);

  return (
    <div className="px-10 py-12 sm:px-14 sm:py-16">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-ink-dim">
            {statusLabel(book.status)} · {pct}%
          </div>
          <h1
            className="font-display mt-3 text-[clamp(2.2rem,4vw,3.4rem)] leading-[1.02] text-ink"
            style={{ fontVariationSettings: '"opsz" 144, "wght" 380, "SOFT" 50' }}
          >
            {book.title}
          </h1>
          <p
            className="font-display mt-2 text-[15px] italic text-ink-soft"
            style={{ fontVariationSettings: '"opsz" 14, "wght" 350' }}
          >
            {book.author}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-dim hover:text-ink"
        >
          Close · esc
        </button>
      </div>

      {/* Progress strip */}
      <div className="mt-10">
        <div
          className="relative h-[2px] w-full overflow-hidden rounded-full"
          style={{ background: "var(--color-line-strong)" }}
        >
          <div
            className="absolute inset-y-0 left-0"
            style={{
              width: `${pct}%`,
              background: style.accent,
              transition: "width 600ms var(--ease-smooth)",
            }}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-dim">
          <span>{completed} complete</span>
          <span>{book.segments.length - completed} remaining</span>
        </div>
      </div>

      <Section title="Segments" subtitle="The pipeline of effort.">
        <ul className="divide-y divide-line">
          {book.segments.map((s) => (
            <SegmentRow
              key={s.id}
              segment={s}
              expanded={expandedSegment === s.id}
              onToggle={() =>
                setExpandedSegment(expandedSegment === s.id ? null : s.id)
              }
              logs={book.logs}
            />
          ))}
          {book.segments.length === 0 && (
            <li className="py-4 text-[14px] text-ink-soft">
              No segments yet. Run the <span className="font-mono text-[12.5px]">setup-book</span> prompt.
            </li>
          )}
        </ul>
      </Section>

      {Object.keys(book.difficulty_map).length > 0 && (
        <Section title="Difficulty map" subtitle="Concepts surfaced during interrogation.">
          <div className="flex flex-wrap gap-2">
            {Object.entries(book.difficulty_map)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <DifficultyTag key={k} concept={k} value={v} />
              ))}
          </div>
        </Section>
      )}

      {book.connections.length > 0 && (
        <Section title="Connections" subtitle="Threads to other books.">
          <ul className="space-y-3">
            {book.connections.map((c, i) => (
              <li key={i} className="rounded-sm border border-line px-4 py-3">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-dim">
                  → {c.target_book}
                </div>
                <div className="mt-1 text-[14px] text-ink-soft">{c.description}</div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {book.logs.length > 0 && (
        <Section title="Recent sessions" subtitle="What the AI has recorded.">
          <ol className="space-y-4">
            {book.logs.slice(0, 6).map((log) => {
              const file = log.path.split("/").pop();
              return (
                <li key={log.path}>
                  <button
                    type="button"
                    onClick={() => file && onOpenLog(book.slug, file)}
                    className="group flex w-full gap-5 text-left"
                    title="Read the full log"
                  >
                    <div className="font-mono text-[11px] text-ink-dim w-24 shrink-0 pt-0.5">
                      {log.date}
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-soft">
                        {log.type}
                        {log.segment ? ` · ${log.segment}` : ""}
                        <span
                          className="ml-2 opacity-0 transition-opacity group-hover:opacity-100"
                          style={{ color: "var(--color-amber)" }}
                        >
                          read →
                        </span>
                      </div>
                      <p className="mt-1 text-[14px] leading-relaxed text-ink">
                        {log.summary || <span className="text-ink-dim italic">No summary.</span>}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {(book.has_thesis || book.has_essay) && (
        <Section title="Final outputs" subtitle="">
          <div className="flex gap-3">
            {book.has_thesis && <Pill>thesis.md</Pill>}
            {book.has_essay && <Pill>essay.md</Pill>}
          </div>
        </Section>
      )}
    </div>
  );
}

function SegmentRow({
  segment,
  expanded,
  onToggle,
  logs,
}: {
  segment: BookDetailT["segments"][number];
  expanded: boolean;
  onToggle: () => void;
  logs: BookDetailT["logs"];
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="group flex w-full items-center gap-5 py-4 text-left transition-colors"
      >
        <span className="font-mono text-[11px] tabular-nums text-ink-dim">
          {segment.id}
        </span>
        <StageMark stage={segment.stage} title={STAGE_LABEL[segment.stage]} size={18} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] text-ink">{segment.title}</div>
          {segment.summary && (
            <div className="mt-0.5 truncate text-[12.5px] text-ink-soft">
              {segment.summary}
            </div>
          )}
        </div>
        <DifficultyChip value={segment.difficulty} />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-dim">
          {STAGE_LABEL[segment.stage]}
        </span>
        <Caret open={expanded} />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transitionTimingFunction: "var(--ease-smooth)",
        }}
      >
        <div className="overflow-hidden">
          {expanded && <SegmentExpansion segment={segment} logs={logs} />}
        </div>
      </div>
    </li>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className="shrink-0"
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 220ms var(--ease-smooth)",
        color: "var(--color-ink-dim)",
      }}
      aria-hidden
    >
      <path
        d="M3 1.5 L7 5 L3 8.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <h2
          className="font-display text-[20px] text-ink"
          style={{ fontVariationSettings: '"opsz" 24, "wght" 420' }}
        >
          {title}
        </h2>
        {subtitle && (
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink-dim">
            {subtitle}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

function DifficultyChip({ value }: { value: number }) {
  if (value <= 0) {
    return <span className="font-mono text-[10.5px] text-ink-dim">—</span>;
  }
  const col = difficultyColor(value);
  return (
    <span
      className="font-mono text-[10.5px] tabular-nums"
      style={{ color: col }}
    >
      {value.toFixed(1)}
    </span>
  );
}

function DifficultyTag({ concept, value }: { concept: string; value: number }) {
  const col = difficultyColor(value);
  return (
    <span
      className="font-mono inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 text-[11.5px]"
      style={{ borderColor: "var(--color-line-strong)", color: "var(--color-ink)" }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: col }}
      />
      <span className="text-ink-soft">{concept}</span>
      <span className="text-ink-dim tabular-nums">{value.toFixed(1)}</span>
    </span>
  );
}

function difficultyColor(value: number): string {
  if (value >= 0.7) return "#a55a3b"; // rust — high difficulty
  if (value >= 0.4) return "#c9933a"; // amber — moderate
  return "#7c9a52"; // soft green — comfortable
}

function statusLabel(s: SegmentStage | "queued" | "active" | "completed"): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="font-mono inline-flex rounded-sm border border-line-strong px-3 py-1.5 text-[11.5px] text-ink-soft"
      style={{ background: "rgba(0,0,0,0.25)" }}
    >
      {children}
    </span>
  );
}
