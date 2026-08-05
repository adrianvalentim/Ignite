import type {
  BookSummary,
  PipelineItem,
  ReviewItem,
  Segment,
  SessionLog,
  TodayPayload,
} from "./types.js";

const RETRIEVAL_TYPES = new Set([
  "interrogation",
  "reconstruction-review",
  "recall",
  "feynman",
  "examination",
]);

const BASE_INTERVALS = [3, 7, 21, 60, 120];
const DAY_MS = 86_400_000;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function toDayNumber(iso: string): number | null {
  const timestamp = Date.parse(iso);
  return Number.isNaN(timestamp) ? null : Math.floor(timestamp / DAY_MS);
}

function dayNumberToISO(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Local calendar date as YYYY-MM-DD (log dates are naive local dates too). */
export function localToday(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** A log's segment field may be "01-loops", "loops", or "01". */
export function logMatchesSegment(reference: string | undefined, segment: Segment): boolean {
  if (!reference) return false;
  return (
    reference === segment.slug ||
    reference === segment.id ||
    reference === `${segment.id}-${segment.slug}`
  );
}

function meanOutcome(outcomes: Record<string, number> | undefined): number | null {
  if (!outcomes) return null;
  const values = Object.values(outcomes);
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function intervalDays(
  retrievalCount: number,
  difficulty: number,
  lastOutcome: number | null,
): number {
  const base =
    BASE_INTERVALS[clamp(retrievalCount, 1, BASE_INTERVALS.length) - 1];
  let factor = clamp(1.5 - difficulty, 0.5, 1.5);
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

function reviewStateFor(
  segment: Segment,
  bookLogs: SessionLog[],
): SegmentReviewState | null {
  let lastTouchedDay = -Infinity;
  let lastTouchedISO = "";
  let retrievalCount = 0;
  let lastRetrievalDay = -Infinity;
  let lastOutcome: number | null = null;

  for (const log of bookLogs) {
    if (!logMatchesSegment(log.segment, segment)) continue;
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
        const outcome = meanOutcome(log.outcomes);
        if (outcome !== null) lastOutcome = outcome;
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
  interrogated: {
    action: "Reconstruct from memory",
    prompt: "reconstruction-review",
  },
  reconstructed: { action: "Draft cards", prompt: "card-generation" },
  carded: { action: "Edit & import cards" },
  complete: null,
};

function suggestedSession(segment: Segment): string {
  switch (segment.stage) {
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
    for (const segment of book.segments) {
      if (segment.stage === "unread" || segment.stage === "read") continue;
      const state = reviewStateFor(segment, bookLogs);
      if (!state) continue;
      const interval = intervalDays(
        state.retrievalCount,
        segment.difficulty,
        state.lastOutcome,
      );
      const nextDay = state.lastTouchedDay + interval;
      const daysOverdue = todayDay - nextDay;
      const item: ReviewItem = {
        book: book.slug,
        book_title: book.title,
        segment,
        last_touched: state.lastTouchedISO,
        next_review: dayNumberToISO(nextDay),
        days_overdue: daysOverdue,
        interval_days: interval,
        retrieval_count: state.retrievalCount,
        suggested: suggestedSession(segment),
      };
      if (daysOverdue >= 0) due.push(item);
      else if (daysOverdue >= -7) upcoming.push(item);
    }

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
    const next = book.segments.find((segment) => segment.stage !== "complete");
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

  due.sort(
    (a, b) =>
      b.days_overdue - a.days_overdue ||
      b.segment.difficulty - a.segment.difficulty,
  );
  upcoming.sort((a, b) => a.next_review.localeCompare(b.next_review));
  pipeline.sort((a, b) =>
    a.book_status === b.book_status
      ? 0
      : a.book_status === "active"
        ? -1
        : 1,
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

/** "35m" -> 35, "1h" -> 60, "1h 20m" -> 80. Unparseable -> 0. */
export function parseDurationMinutes(raw: string | undefined): number {
  if (!raw) return 0;
  let minutes = 0;
  const hours = raw.match(/(\d+)\s*h/i);
  const remainder = raw.match(/(\d+)\s*m/i);
  if (hours) minutes += Number(hours[1]) * 60;
  if (remainder) minutes += Number(remainder[1]);
  return minutes;
}
