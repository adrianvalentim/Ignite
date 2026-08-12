import DOMPurify from "dompurify";
import { useEffect, useMemo, useState } from "react";
import type { LogDetail } from "../../../shared/types";
import { api } from "../lib/api";

export interface LogRef {
  book: string;
  /** Filename inside the book's logs/ directory. */
  file: string;
}

interface Props {
  logRef: LogRef;
  onClose: () => void;
}

/** Full reading view for a single session log. */
export function LogModal({ logRef, onClose }: Props) {
  const [log, setLog] = useState<LogDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const safeBodyHtml = useMemo(
    () =>
      DOMPurify.sanitize(log?.body_html ?? "", {
        USE_PROFILES: { html: true },
        FORBID_TAGS: ["style"],
        FORBID_ATTR: ["style"],
      }),
    [log?.body_html],
  );

  useEffect(() => {
    let cancelled = false;
    setLog(null);
    setError(null);
    api
      .log(logRef.book, logRef.file)
      .then((l) => !cancelled && setLog(l))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [logRef.book, logRef.file]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto px-4 py-10 sm:py-16">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 cursor-default"
        style={{ background: "var(--backdrop)", backdropFilter: "blur(2px)" }}
      />
      <article
        className="fade-rise grain grain-paper relative w-full max-w-2xl rounded-sm border"
        style={{
          background: "var(--color-bg-elev)",
          borderColor: "var(--color-line-strong)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {!log && !error && (
          <div className="px-10 py-16 text-center font-mono text-[11px] uppercase tracking-[0.3em] text-ink-dim">
            Opening the log…
          </div>
        )}
        {error && (
          <div className="px-10 py-12">
            <h2 className="font-display text-xl text-ink">Could not open the log.</h2>
            <p className="mt-2 font-mono text-[11.5px] text-ink-dim">{error}</p>
          </div>
        )}
        {log && (
          <div className="px-8 py-10 sm:px-12">
            <header className="flex items-start justify-between gap-6">
              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-ink-dim">
                  <span style={{ color: "var(--color-ink)" }}>{log.date}</span>
                  <span className="mx-2 opacity-50">·</span>
                  <span style={{ color: "var(--color-amber)" }}>{log.type}</span>
                  {log.segment && (
                    <>
                      <span className="mx-2 opacity-50">·</span>
                      <span>{log.segment}</span>
                    </>
                  )}
                  {log.duration_approx && (
                    <>
                      <span className="mx-2 opacity-50">·</span>
                      <span>{log.duration_approx}</span>
                    </>
                  )}
                </div>
                <h1
                  className="font-display mt-2 text-[26px] leading-tight text-ink"
                  style={{ fontVariationSettings: '"opsz" 72, "wght" 400' }}
                >
                  {log.book_title ?? log.book}
                </h1>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="font-mono shrink-0 text-[11px] uppercase tracking-[0.22em] text-ink-dim hover:text-ink"
              >
                Close · esc
              </button>
            </header>

            {log.outcomes && Object.keys(log.outcomes).length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {Object.entries(log.outcomes)
                  .sort((a, b) => a[1] - b[1])
                  .map(([concept, value]) => (
                    <OutcomeChip key={concept} concept={concept} value={value} />
                  ))}
              </div>
            )}

            <div
              className="md-body mt-8"
              // Vault Markdown may contain raw HTML, so sanitize it at the render boundary.
              dangerouslySetInnerHTML={{ __html: safeBodyHtml }}
            />
          </div>
        )}
      </article>
    </div>
  );
}

function OutcomeChip({ concept, value }: { concept: string; value: number }) {
  const color =
    value >= 0.7
      ? "var(--color-green)"
      : value >= 0.4
        ? "var(--color-amber)"
        : "var(--color-rust)";
  return (
    <span
      className="font-mono inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 text-[11px]"
      style={{ borderColor: "var(--color-line-strong)" }}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color }}
      />
      <span className="text-ink-soft">{concept}</span>
      <span className="tabular-nums text-ink-dim">{Math.round(value * 100)}%</span>
    </span>
  );
}
