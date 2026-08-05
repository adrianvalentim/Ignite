import type {
  BookSummary,
  RetentionPoint,
  SegmentStage,
  SessionLog,
  StatsPayload,
  WeekBucket,
} from "./types.js";
import { parseDurationMinutes } from "./schedule.js";

const DAY_MS = 86_400_000;
const WEEKS_SHOWN = 16;

function toDayNumber(iso: string): number | null {
  const timestamp = Date.parse(iso);
  return Number.isNaN(timestamp) ? null : Math.floor(timestamp / DAY_MS);
}

function mondayOf(day: number): number {
  return day - ((day + 3) % 7);
}

function dayNumberToISO(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function buildStatsFrom(
  books: BookSummary[],
  logs: SessionLog[],
  todayISO: string,
): StatsPayload {
  const todayDay = toDayNumber(todayISO) ?? 0;
  let currentMonday = mondayOf(todayDay);

  let latestLogDay = -Infinity;
  for (const log of logs) {
    const day = toDayNumber(log.date);
    if (day !== null && day > latestLogDay) latestLogDay = day;
  }
  if (
    Number.isFinite(latestLogDay) &&
    mondayOf(latestLogDay) < currentMonday - (WEEKS_SHOWN - 1) * 7
  ) {
    currentMonday = mondayOf(latestLogDay);
  }

  const weeks: WeekBucket[] = [];
  const weekIndex = new Map<number, WeekBucket>();
  for (let index = WEEKS_SHOWN - 1; index >= 0; index--) {
    const monday = currentMonday - index * 7;
    const bucket: WeekBucket = {
      week_start: dayNumberToISO(monday),
      sessions: 0,
      minutes: 0,
    };
    weeks.push(bucket);
    weekIndex.set(monday, bucket);
  }

  const retention: RetentionPoint[] = [];
  let totalMinutes = 0;
  for (const log of logs) {
    const day = toDayNumber(log.date);
    if (day === null) continue;
    const minutes = parseDurationMinutes(log.duration_approx);
    totalMinutes += minutes;

    const bucket = weekIndex.get(mondayOf(day));
    if (bucket) {
      bucket.sessions++;
      bucket.minutes += minutes;
    }

    if (log.outcomes) {
      const values = Object.values(log.outcomes);
      if (values.length > 0) {
        retention.push({
          date: log.date,
          book: log.book,
          segment: log.segment,
          value: values.reduce((total, value) => total + value, 0) / values.length,
          concepts: values.length,
        });
      }
    }
  }
  retention.sort((a, b) => a.date.localeCompare(b.date));

  const stageCounts: Record<SegmentStage, number> = {
    unread: 0,
    read: 0,
    interrogated: 0,
    reconstructed: 0,
    carded: 0,
    complete: 0,
  };
  let segmentsComplete = 0;
  for (const book of books) {
    for (const segment of book.segments) {
      stageCounts[segment.stage] = (stageCounts[segment.stage] ?? 0) + 1;
      if (segment.stage === "complete") segmentsComplete++;
    }
  }

  return {
    weeks,
    stage_counts: stageCounts,
    retention,
    totals: {
      sessions: logs.length,
      minutes: totalMinutes,
      books: books.length,
      segments_complete: segmentsComplete,
    },
  };
}
