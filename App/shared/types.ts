// Shared types between backend and frontend.
// Imported via relative paths so no build step is required.

export type SegmentStage =
  | "unread"
  | "read"
  | "interrogated"
  | "reconstructed"
  | "carded"
  | "complete";

export type BookStatus = "queued" | "active" | "completed";

export interface Segment {
  id: string;
  slug: string;
  title: string;
  summary: string;
  stage: SegmentStage;
  difficulty: number;
  sessions: number;
}

export interface BookConnection {
  target_book: string;
  description: string;
}

export interface BookMeta {
  title: string;
  author: string;
  slug: string;
  date_added: string;
  date_started?: string;
  date_completed?: string;
  status: BookStatus;
  total_segments: number;
  segments: Segment[];
  difficulty_map: Record<string, number>;
  connections: BookConnection[];
  cover?: string;
}

export interface BookSummary extends BookMeta {
  progress: {
    completed: number;
    total: number;
    last_active?: string;
  };
}

export interface BookDetail extends BookSummary {
  body_html: string;
  logs: SessionLog[];
  has_thesis: boolean;
  has_essay: boolean;
}

export interface SessionLog {
  path: string;
  date: string;
  book: string;
  segment?: string;
  type: string;
  duration_approx?: string;
  summary: string;
  /** Optional demonstrated-recall scores per concept, 0.0–1.0. */
  outcomes?: Record<string, number>;
}

export interface LogDetail extends SessionLog {
  body_html: string;
  book_title?: string;
}

// ---------------------------------------------------------------------------
// Review scheduling — fully derived from book.md + logs; nothing is written.

export interface ReviewItem {
  book: string;
  book_title: string;
  segment: Segment;
  /** Date of the most recent session touching this segment. */
  last_touched: string;
  /** Derived date this segment comes due for another retrieval pass. */
  next_review: string;
  /** Positive when overdue, negative when still ahead. */
  days_overdue: number;
  interval_days: number;
  /** Number of retrieval-type sessions logged so far. */
  retrieval_count: number;
  /** Suggested session type, e.g. "recall" or "interrogation". */
  suggested: string;
}

export interface PipelineItem {
  book: string;
  book_title: string;
  book_status: BookStatus;
  segment?: Segment;
  /** Human action, e.g. "Read", "Interrogate", "Final examination". */
  action: string;
  /** Prompt file that drives the session, when one exists. */
  prompt?: string;
}

export interface TodayStats {
  due_count: number;
  sessions_7d: number;
  minutes_7d: number;
  streak_days: number;
}

export interface TodayPayload {
  date: string;
  due: ReviewItem[];
  upcoming: ReviewItem[];
  pipeline: PipelineItem[];
  stats: TodayStats;
}

// ---------------------------------------------------------------------------
// Stats — aggregates for the Ledger view.

export interface WeekBucket {
  /** Monday of the ISO week, YYYY-MM-DD. */
  week_start: string;
  sessions: number;
  minutes: number;
}

export interface RetentionPoint {
  date: string;
  book: string;
  segment?: string;
  /** Mean of the log's outcome scores, 0.0–1.0. */
  value: number;
  concepts: number;
}

export interface StatsPayload {
  weeks: WeekBucket[];
  stage_counts: Record<SegmentStage, number>;
  retention: RetentionPoint[];
  totals: {
    sessions: number;
    minutes: number;
    books: number;
    segments_complete: number;
  };
}

// ---------------------------------------------------------------------------
// Coherent workspace reads used by both browser and desktop refreshes.

export interface WorkspaceData {
  books: BookSummary[];
  logs: SessionLog[];
}

export interface WorkspaceSnapshot extends WorkspaceData {
  today: TodayPayload;
  stats: StatsPayload;
}

// ---------------------------------------------------------------------------
// Search

export type SearchKind =
  | "book"
  | "source"
  | "log"
  | "reconstruction"
  | "cards"
  | "thesis"
  | "essay"
  | "cross-book";

export interface SearchResult {
  kind: SearchKind;
  /** Path relative to the workspace root. */
  file: string;
  book?: string;
  book_title?: string;
  title: string;
  snippet: string;
  score: number;
  /** Set for kind === "log": the filename inside the book's logs/ dir. */
  log_file?: string;
}
