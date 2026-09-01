import type { View } from "../lib/view";

interface Props {
  view: View;
  onChange: (next: View) => void;
  onSearch: () => void;
  workspacePath?: string | null;
  choosingWorkspace?: boolean;
  onChooseWorkspace?: () => void;
}

const VIEWS: { id: View; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "library", label: "Library" },
  { id: "kanban", label: "Board" },
  { id: "timeline", label: "Chronicle" },
  { id: "stats", label: "Ledger" },
  { id: "chat", label: "Codex" },
];

export function ViewSwitcher({
  view,
  onChange,
  onSearch,
  workspacePath,
  choosingWorkspace = false,
  onChooseWorkspace,
}: Props) {
  const workspaceName = workspacePath
    ?.replaceAll("\\", "/")
    .split("/")
    .filter(Boolean)
    .at(-1);

  return (
    <div
      className="fixed left-6 top-6 z-[60] inline-flex max-w-[calc(100vw-3rem)] items-center gap-0 rounded-full border px-1 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] sm:tracking-[0.22em]"
      style={{
        borderColor: "var(--color-line-strong)",
        background: "color-mix(in srgb, var(--color-bg-elev) 75%, transparent)",
        backdropFilter: "blur(6px)",
      }}
    >
      {workspacePath && onChooseWorkspace && (
        <>
          <button
            type="button"
            onClick={onChooseWorkspace}
            disabled={choosingWorkspace}
            aria-label={`Change workspace. Current workspace: ${workspaceName ?? workspacePath}`}
            title={`Change workspace: ${workspacePath}`}
            className="flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-ink-dim transition-colors duration-200 hover:text-ink-soft disabled:cursor-wait disabled:opacity-50 sm:px-2.5"
            style={{ transitionTimingFunction: "var(--ease-smooth)" }}
          >
            <FolderIcon />
          </button>
          <span
            aria-hidden
            className="mx-1 h-4 w-px"
            style={{ background: "var(--color-line-strong)" }}
          />
        </>
      )}

      {VIEWS.map((v) => {
        const active = view === v.id;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onChange(v.id)}
            aria-current={active ? "page" : undefined}
            className="relative rounded-full px-2 py-1 transition-colors duration-200 sm:px-3"
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

      <span
        aria-hidden
        className="mx-1 h-4 w-px"
        style={{ background: "var(--color-line-strong)" }}
      />
      <button
        type="button"
        onClick={onSearch}
        aria-label="Search the workspace (⌘K)"
        title="Search · ⌘K"
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors duration-200"
        style={{
          color: "var(--color-ink-soft)",
          transitionTimingFunction: "var(--ease-smooth)",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden>
          <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.3" />
          <line
            x1="9.2"
            y1="9.2"
            x2="12.4"
            y2="12.4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
        <span className="hidden sm:inline">⌘K</span>
      </button>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M1.75 4.25h4.1l1.2 1.5h7.2v6.5a1.25 1.25 0 0 1-1.25 1.25H3a1.25 1.25 0 0 1-1.25-1.25v-8Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M1.75 5.75V3.5c0-.55.45-1 1-1H5.2l1.4 1.75h6.65c.55 0 1 .45 1 1v.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
