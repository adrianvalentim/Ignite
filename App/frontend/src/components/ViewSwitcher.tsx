import type { View } from "../lib/view";

interface Props {
  view: View;
  onChange: (next: View) => void;
}

const VIEWS: { id: View; label: string }[] = [
  { id: "library", label: "Library" },
  { id: "kanban", label: "Board" },
  { id: "timeline", label: "Chronicle" },
];

export function ViewSwitcher({ view, onChange }: Props) {
  return (
    <div
      className="fixed left-6 top-6 z-[60] inline-flex items-center gap-0 rounded-full border px-1 py-1 font-mono text-[10.5px] uppercase tracking-[0.22em]"
      style={{
        borderColor: "var(--color-line-strong)",
        background: "color-mix(in srgb, var(--color-bg-elev) 75%, transparent)",
        backdropFilter: "blur(6px)",
      }}
    >
      {VIEWS.map((v) => {
        const active = view === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            aria-current={active ? "page" : undefined}
            className="relative rounded-full px-3 py-1 transition-colors duration-200"
            style={{
              color: active ? "var(--color-amber)" : "var(--color-ink-soft)",
              background: active
                ? "color-mix(in srgb, var(--color-amber) 12%, transparent)"
                : "transparent",
              transitionTimingFunction: "var(--ease-smooth)",
            }}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
