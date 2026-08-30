import type { SegmentStage } from "../../../shared/types";

interface Props {
  stage: SegmentStage;
  size?: number;
  title?: string;
}

/**
 * Geometric stage marker drawn from a single grid so progression reads as
 * physical: hollow → quarter → half → three-quarter → full → sealed.
 */
export function StageMark({ stage, size = 16, title }: Props) {
  const color = stageColor(stage);
  const fillAngle = stageAngle(stage);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-label={title ?? stage}
      role="img"
      style={{ flexShrink: 0 }}
    >
      <title>{title ?? stage}</title>
      {/* outer ring */}
      <circle
        cx="10"
        cy="10"
        r="7.5"
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        opacity={stage === "unread" ? 0.55 : 0.9}
      />
      {/* fill wedge */}
      {fillAngle > 0 && (
        <path d={wedgePath(10, 10, 6.5, fillAngle)} fill={color} opacity="0.95" />
      )}
      {/* completion mark */}
      {stage === "complete" && (
        <path
          d="M6.4 10.2 L8.9 12.7 L13.8 7.6"
          fill="none"
          stroke="var(--stage-seal)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function stageColor(stage: SegmentStage): string {
  switch (stage) {
    case "unread":
      return "var(--color-ink-dim)";
    case "read":
      return "var(--color-ink-soft)";
    case "interrogated":
      return "var(--color-slate-blue)";
    case "reconstructed":
      return "var(--color-amber)";
    case "carded":
      return "var(--color-amber)";
    case "complete":
      return "var(--stage-complete)";
  }
}

function stageAngle(stage: SegmentStage): number {
  // degrees of fill, starting at 12 o'clock and going clockwise
  switch (stage) {
    case "unread":
      return 0;
    case "read":
      return 180;
    case "interrogated":
      return 270;
    case "reconstructed":
    case "carded":
    case "complete":
      return 360;
  }
}

function wedgePath(cx: number, cy: number, r: number, angleDeg: number): string {
  if (angleDeg >= 360) {
    return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`;
  }
  const rad = (angleDeg - 90) * (Math.PI / 180);
  const startX = cx;
  const startY = cy - r;
  const endX = cx + r * Math.cos(rad);
  const endY = cy + r * Math.sin(rad);
  const largeArc = angleDeg > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

export const STAGE_LABEL: Record<SegmentStage, string> = {
  unread: "Unread",
  read: "Read",
  interrogated: "Interrogated",
  reconstructed: "Reconstructed",
  carded: "Cards drafted",
  complete: "Complete",
};
