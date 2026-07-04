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
}
