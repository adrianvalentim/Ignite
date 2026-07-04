import type { Theme } from "../lib/theme";

interface Props {
  theme: Theme;
  onToggle: () => void;
}

/**
 * A discreet sun/moon control. The icon shown is what you'll switch *to*,
 * so the affordance reads as "change the light in the room."
 */
export function ThemeToggle({ theme, onToggle }: Props) {
  const next = theme === "dark" ? "Daylight" : "Evening";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${next.toLowerCase()} mode`}
      title={`${next} mode`}
      className="fixed right-6 top-6 z-[60] inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] transition-[background,color,border-color] duration-300"
      style={{
        borderColor: "var(--color-line-strong)",
        color: "var(--color-ink-soft)",
        background: "color-mix(in srgb, var(--color-bg-elev) 75%, transparent)",
        backdropFilter: "blur(6px)",
        transitionTimingFunction: "var(--ease-smooth)",
      }}
    >
      <Icon theme={theme} />
      <span>{next}</span>
    </button>
  );
}

function Icon({ theme }: { theme: Theme }) {
  if (theme === "dark") {
    // Show a sun — clicking moves to daylight
    return (
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.2" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          const x1 = 8 + Math.cos(rad) * 5;
          const y1 = 8 + Math.sin(rad) * 5;
          const x2 = 8 + Math.cos(rad) * 6.8;
          const y2 = 8 + Math.sin(rad) * 6.8;
          return (
            <line
              key={deg}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
    );
  }
  // Light theme — show a moon, clicking moves to evening
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M12.5 9.5 A 5.5 5.5 0 1 1 6.5 3.5 A 4.2 4.2 0 0 0 12.5 9.5 Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
