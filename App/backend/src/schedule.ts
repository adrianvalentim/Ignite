import type {
  BookSummary,
  PipelineItem,
  ReviewItem,
  Segment,
  SessionLog,
  TodayPayload,
} from "../../shared/types.js";
import { readAllBooks, readAllLogs } from "./workspace.js";

// ---------------------------------------------------------------------------
// Review scheduling, fully derived from the vault. The filesystem stays the
// source of truth: nothing here writes state, so the schedule can never
// disagree with the logs it is computed from.
//
// A segment becomes reviewable once it has at least one retrieval-type
// session. Each further retrieval pushes it up an interval ladder; the
// interval is then scaled by how hard the segment is and by how well the
// last retrieval actually went (when the log recorded outcomes).

const RETRIEVAL_TYPES = new Set([
  "interrogation",
  "reconstruction-review",
  "recall",
  "feynman",
  "examination",
]);

/** Days until the next review, by number of completed retrievals (1-based). */
const BASE_INTERVALS = [3, 7, 21, 60, 120];

const DAY_MS = 86_400_000;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function toDayNumber(iso: string): number | null {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.floor(t / DAY_MS);
}

function dayNumberToISO(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Local calendar date as YYYY-MM-DD (log dates are naive local dates too). */
export function localToday(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** A log's segment field may be "01-loops", "loops", or "01". */
export function logMatchesSegment(ref: string | undefined, seg: Segment): boolean {
  if (!ref) return false;
  return ref === seg.slug || ref === seg.id || ref === `${seg.id}-${seg.slug}`;
}

function meanOutcome(outcomes: Record<string, number> | undefined): number | null {
  if (!outcomes) return null;
  const values = Object.values(outcomes);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function intervalDays(
  retrievalCount: number,
  difficulty: number,
  lastOutcome: number | null,
): number {
  const base =
    BASE_INTERVALS[clamp(retrievalCount, 1, BASE_INTERVALS.length) - 1];
  // Difficulty 0 stretches the interval 1.5×, difficulty 1 halves it.
  let factor = clamp(1.5 - difficulty, 0.5, 1.5);
  // A measured outcome refines the estimate: 0.5 is neutral, 1.0 stretches,
  // 0.0 halves. Without outcomes the difficulty rating stands alone.
  if (lastOutcome !== null) {
    factor *= clamp(0.5 + lastOutcome, 0.5, 1.5);
  }
  return Math.max(1, Math.round(base * factor));
}

interface SegmentReviewState {
  lastTouchedDay: number;
  lastTouchedISO: string;
  retrievalCount: number;
  lastOutcome: number | null;
}

function reviewStateFor(seg: Segment, bookLogs: SessionLog[]): SegmentReviewState | null {
  let lastTouchedDay = -Infinity;
  let lastTouchedISO = "";
  let retrievalCount = 0;
  let lastRetrievalDay = -Infinity;
  let lastOutcome: number | null = null;

  for (const log of bookLogs) {
    if (!logMatchesSegment(log.segment, seg)) continue;
    const day = toDayNumber(log.date);
    if (day === null) continue;
    if (day > lastTouchedDay) {
      lastTouchedDay = day;
      lastTouchedISO = log.date;
    }
    if (RETRIEVAL_TYPES.has(log.type)) {
      retrievalCount++;
      if (day >= lastRetrievalDay) {
        lastRetrievalDay = day;
        const mean = meanOutcome(log.outcomes);
        if (mean !== null) lastOutcome = mean;
      }
    }
  }

  if (retrievalCount === 0 || !Number.isFinite(lastTouchedDay)) return null;
  return { lastTouchedDay, lastTouchedISO, retrievalCount, lastOutcome };
}

const STAGE_ACTION: Record<
  Segment["stage"],
  { action: string; prompt?: string } | null
> = {
  unread: { action: "Read" },
  read: { action: "Interrogate", prompt: "interrogation" },
  interrogated: { action: "Reconstruct from memory", prompt: "reconstruction-review" },
  reconstructed: { action: "Draft cards", prompt: "card-generation" },
  carded: { action: "Edit & import cards" },
  complete: null,
};

function suggestedSession(seg: Segment): string {
  // Segments still mid-pipeline are best reviewed by advancing the pipeline;
  // finished ones come back as free recall.
  switch (seg.stage) {
    case "read":
      return "interrogation";
    case "interrogated":
      return "reconstruction";
    case "reconstructed":
      return "recall";
    default:
      return "recall";
  }
}

export function buildTodayFrom(
  books: BookSummary[],
  logs: SessionLog[],
  todayISO: string,
): TodayPayload {
  const todayDay = toDayNumber(todayISO) ?? 0;
  const due: ReviewItem[] = [];
  const upcoming: ReviewItem[] = [];
  const pipeline: PipelineItem[] = [];

  const logsByBook = new Map<string, SessionLog[]>();
  for (const log of logs) {
    const list = logsByBook.get(log.book) ?? [];
    list.push(log);
    logsByBook.set(log.book, list);
  }

  for (const book of books) {
    const bookLogs = logsByBook.get(book.slug) ?? [];

    // Review queue — anything with retrieval history gets a due date.
    for (const seg of book.segments) {
      if (seg.stage === "unread" || seg.stage === "read") continue;
      const state = reviewStateFor(seg, bookLogs);
      if (!state) continue;
      const interval = intervalDays(
        state.retrievalCount,
        seg.difficulty,
        state.lastOutcome,
      );
      const nextDay = state.lastTouchedDay + interval;
      const daysOverdue = todayDay - nextDay;
      const item: ReviewItem = {
        book: book.slug,
        book_title: book.title,
        segment: seg,
        last_touched: state.lastTouchedISO,
        next_review: dayNumberToISO(nextDay),
        days_overdue: daysOverdue,
        interval_days: interval,
        retrieval_count: state.retrievalCount,
        suggested: suggestedSession(seg),
      };
      if (daysOverdue >= 0) due.push(item);
      else if (daysOverdue >= -7) upcoming.push(item);
    }

    // Pipeline — the next move per book, so the desk stays calm.
    if (book.status === "completed") continue;
    if (book.segments.length === 0) {
      pipeline.push({
        book: book.slug,
        book_title: book.title,
        book_status: book.status,
        action: "Set up the book",
        prompt: "setup-book",
      });
      continue;
    }
    const next = book.segments.find((s) => s.stage !== "complete");
    if (!next) {
      pipeline.push({
        book: book.slug,
        book_title: book.title,
        book_status: book.status,
        action: "Final examination",
        prompt: "examination",
      });
      continue;
    }
    const move = STAGE_ACTION[next.stage];
    if (move) {
      pipeline.push({
        book: book.slug,
        book_title: book.title,
        book_status: book.status,
        segment: next,
        action: move.action,
        prompt: move.prompt,
      });
    }
  }

  // Most overdue first; ties broken by difficulty so the shakiest memory wins.
  due.sort(
    (a, b) =>
      b.days_overdue - a.days_overdue || b.segment.difficulty - a.segment.difficulty,
  );
  upcoming.sort((a, b) => a.next_review.localeCompare(b.next_review));
  // Active books before queued ones.
  pipeline.sort((a, b) =>
    a.book_status === b.book_status ? 0 : a.book_status === "active" ? -1 : 1,
  );

  return {
    date: todayISO,
    due,
    upcoming,
    pipeline,
    stats: computeTodayStats(logs, todayDay, due.length),
  };
}

function computeTodayStats(
  logs: SessionLog[],
  todayDay: number,
  dueCount: number,
): TodayPayload["stats"] {
  let sessions7d = 0;
  let minutes7d = 0;
  const activeDays = new Set<number>();

  for (const log of logs) {
    const day = toDayNumber(log.date);
    if (day === null) continue;
    activeDays.add(day);
    if (todayDay - day < 7 && todayDay - day >= 0) {
      sessions7d++;
      minutes7d += parseDurationMinutes(log.duration_approx);
    }
  }

  // Streak: consecutive days with at least one session, counting back from
  // today (or from yesterday, so this morning's empty log doesn't zero it).
  let streak = 0;
  let cursor = activeDays.has(todayDay) ? todayDay : todayDay - 1;
  while (activeDays.has(cursor)) {
    streak++;
    cursor--;
  }

  return {
    due_count: dueCount,
    sessions_7d: sessions7d,
    minutes_7d: minutes7d,
    streak_days: streak,
  };
}

/** "35m" → 35, "1h" → 60, "1h 20m" → 80. Unparseable → 0. */
export function parseDurationMinutes(raw: string | undefined): number {
  if (!raw) return 0;
  let minutes = 0;
  const h = raw.match(/(\d+)\s*h/i);
  const m = raw.match(/(\d+)\s*m/i);
  if (h) minutes += Number(h[1]) * 60;
  if (m) minutes += Number(m[1]);
  return minutes;
}

export async function buildToday(workspace: string): Promise<TodayPayload> {
  const [books, logs] = await Promise.all([
    readAllBooks(workspace),
    readAllLogs(workspace),
  ]);
  return buildTodayFrom(books, logs, localToday());
}
