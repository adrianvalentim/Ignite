import type { Segment, SegmentStage, SessionLog } from "../../../shared/types";

// The pipeline as a sequence. Each step's "reached" boolean is derived
// from the segment's single stage value — stages are monotonic, so any
// stage past or equal to the threshold means earlier steps are done.
const PIPELINE: {
  id: SegmentStage;
  label: string;
  blurb: string;
  threshold: number;
}[] = [
  { id: "read", label: "Read", blurb: "First reading, no AI.", threshold: 1 },
  {
    id: "interrogated",
    label: "Interrogate",
    blurb: "Socratic conversation with the AI.",
    threshold: 2,
  },
  {
    id: "reconstructed",
    label: "Reconstruct",
    blurb: "Write the segment from memory, then have it reviewed.",
    threshold: 3,
  },
  {
    id: "carded",
    label: "Cards",
    blurb: "AI drafts Anki cards; you edit them.",
    threshold: 4,
  },
  {
    id: "complete",
    label: "Complete",
    blurb: "Segment fully metabolised.",
    threshold: 5,
  },
];

const RANK: Record<SegmentStage, number> = {
  unread: 0,
  read: 1,
  interrogated: 2,
  reconstructed: 3,
  carded: 4,
  complete: 5,
};

interface Props {
  segment: Segment;
  logs: SessionLog[];
}

export function SegmentExpansion({ segment, logs }: Props) {
  const current = RANK[segment.stage];
  const nextIdx = PIPELINE.findIndex((p) => p.threshold > current);

  const segmentLogs = logs.filter(
    (l) => l.segment === `${segment.id}-${segment.slug}` || l.segment === segment.slug,
  );

  return (
    <div className="ml-9 mt-2 grid grid-cols-[1fr_auto] gap-x-10 gap-y-6 border-l border-line pl-6 pb-3">
      <div>
        <SectionLabel>Pipeline</SectionLabel>
        <ol className="mt-3 space-y-2.5">
          {PIPELINE.map((step, i) => {
            const done = current >= step.threshold;
            const isNext = i === nextIdx;
            return (
              <li key={step.id} className="flex items-start gap-3.5">
                <PipelineDot done={done} next={isNext} />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-[13px]"
                      style={{
                        color: done
                          ? "var(--color-ink)"
                          : isNext
                            ? "var(--color-ink)"
                            : "var(--color-ink-dim)",
                      }}
                    >
                      {step.label}
                    </span>
                    {isNext && (
                      <span
                        className="font-mono text-[9.5px] uppercase tracking-[0.22em]"
                        style={{ color: "var(--color-amber)" }}
                      >
                        Next
                      </span>
                    )}
                    {done && (
                      <span
                        className="font-mono text-[9.5px] uppercase tracking-[0.22em]"
                        style={{ color: "var(--color-ink-dim)" }}
                      >
                        Done
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-0.5 text-[12px] leading-snug"
                    style={{ color: "var(--color-ink-soft)" }}
                  >
                    {step.blurb}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="min-w-[14rem]">
        <SectionLabel>Sessions</SectionLabel>
        {segmentLogs.length === 0 ? (
          <p
            className="mt-3 text-[12.5px]"
            style={{ color: "var(--color-ink-dim)" }}
          >
            No sessions recorded for this segment yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {segmentLogs.slice(0, 4).map((log) => (
              <li key={log.path} className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] tabular-nums text-ink-dim shrink-0">
                  {log.date}
                </span>
                <span
                  className="font-mono text-[10.5px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--color-ink-soft)" }}
                >
                  {log.type}
                </span>
              </li>
            ))}
          </ul>
        )}

        {segment.sessions > 0 && (
          <div
            className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.22em]"
            style={{ color: "var(--color-ink-dim)" }}
          >
            {segment.sessions} session{segment.sessions === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-mono text-[10px] uppercase tracking-[0.28em]"
      style={{ color: "var(--color-ink-dim)" }}
    >
      {children}
    </div>
  );
}

function PipelineDot({ done, next }: { done: boolean; next: boolean }) {
  const color = done
    ? "var(--color-amber)"
    : next
      ? "var(--color-amber)"
      : "var(--color-ink-dim)";

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className="mt-[3px] shrink-0"
      aria-hidden
    >
      <circle
        cx="7"
        cy="7"
        r="5"
        fill={done ? color : "none"}
        stroke={color}
        strokeWidth={done ? 0 : 1.2}
        opacity={!done && !next ? 0.55 : 1}
      />
      {done && (
        <path
          d="M4.4 7.2 L6.2 9 L9.6 5"
          fill="none"
          stroke="var(--color-bg)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {next && !done && (
        <circle cx="7" cy="7" r="2.2" fill={color} opacity="0.5">
          <animate
            attributeName="opacity"
            values="0.35;0.85;0.35"
            dur="2.4s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </svg>
  );
}
