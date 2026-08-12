import type {
  BookDetail,
  BookMeta,
  BookSummary,
  LogDetail,
  SearchKind,
  SearchResult,
  Segment,
  SegmentStage,
  SessionLog,
  WorkspaceData,
} from "./types.js";

export interface VaultEntry {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
}

export interface MarkdownDocument {
  data: Record<string, unknown>;
  content: string;
}

/**
 * The only filesystem boundary used by the tracker. Implementations may use
 * Node (browser/server mode) or Tauri's scoped filesystem plugin (desktop).
 */
export interface VaultReader {
  readText(relativePath: string): Promise<string>;
  readDir(relativePath: string): Promise<VaultEntry[]>;
  exists(relativePath: string): Promise<boolean>;
  size(relativePath: string): Promise<number | null>;
  parseMarkdown(raw: string): MarkdownDocument;
  renderMarkdown(markdown: string): Promise<string>;
}

export interface VaultService {
  readBookSummary(slug: string): Promise<BookSummary | null>;
  readBookDetail(slug: string): Promise<BookDetail | null>;
  readWorkspaceData(): Promise<WorkspaceData>;
  readAllBooks(): Promise<BookSummary[]>;
  readLogDetail(slug: string, file: string): Promise<LogDetail | null>;
  readAllLogs(): Promise<SessionLog[]>;
  search(query: string): Promise<SearchResult[]>;
}

export interface VaultServiceOptions {
  /** Surface filesystem/parser errors instead of treating the vault as empty. */
  strict?: boolean;
}

const COMPLETED_STAGES: SegmentStage[] = ["complete"];
const MAX_RESULTS = 20;
const MAX_FILE_BYTES = 512 * 1024;
const TITLE_WEIGHT = 6;
const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/i;
const LOG_FILE_RE = /^[a-z0-9][a-z0-9._-]*\.md$/i;

function vaultPath(...parts: string[]): string {
  return parts.filter(Boolean).join("/");
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normaliseSegments(raw: unknown): Segment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((segment, index) => {
    const value = (segment ?? {}) as Record<string, unknown>;
    return {
      id: asString(value.id, String(index + 1).padStart(2, "0")),
      slug: asString(value.slug, `segment-${index + 1}`),
      title: asString(value.title, `Segment ${index + 1}`),
      summary: asString(value.summary),
      stage: asString(value.stage, "unread") as SegmentStage,
      difficulty: asNumber(value.difficulty, 0),
      sessions: asNumber(value.sessions, 0),
    };
  });
}

function normaliseDifficultyMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number") result[key] = value;
  }
  return result;
}

function normaliseOutcomes(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      result[key] = Math.min(1, Math.max(0, value));
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function normaliseConnections(raw: unknown): BookMeta["connections"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((connection) => {
      const value = (connection ?? {}) as Record<string, unknown>;
      return {
        target_book: asString(value.target_book),
        description: asString(value.description),
      };
    })
    .filter((connection) => connection.target_book.length > 0);
}

function parseBookMeta(data: Record<string, unknown>, slug: string): BookMeta {
  return {
    title: asString(data.title, slug),
    author: asString(data.author),
    slug: asString(data.slug, slug),
    date_added: asString(data.date_added),
    date_started: asString(data.date_started) || undefined,
    date_completed: asString(data.date_completed) || undefined,
    status: asString(data.status, "queued") as BookMeta["status"],
    total_segments: asNumber(data.total_segments),
    segments: normaliseSegments(data.segments),
    difficulty_map: normaliseDifficultyMap(data.difficulty_map),
    connections: normaliseConnections(data.connections),
    cover: typeof data.cover === "string" ? data.cover : undefined,
  };
}

function isVisibleMarkdown(name: string): boolean {
  return name.endsWith(".md") && !name.startsWith(".") && !name.startsWith("._");
}

function humanise(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .replace(/^\d+[-.]?/, "")
    .replace(/-/g, " ")
    .replace(/(^|\s)\w/g, (character) => character.toUpperCase())
    .trim();
}

function logTitle(filename: string): string {
  const match = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  if (!match) return humanise(filename);
  return `${humanise(`${match[2]}.md`)} — ${match[1]}`;
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = 0;
  while (count < 50) {
    index = haystack.indexOf(needle, index);
    if (index === -1) break;
    count++;
    index += needle.length;
  }
  return count;
}

function plainify(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/^[-+]\s+/gm, "");
}

function makeSnippet(content: string, terms: string[]): string {
  const lower = content.toLowerCase();
  let hit = -1;
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index !== -1 && (hit === -1 || index < hit)) hit = index;
  }
  if (hit === -1) hit = 0;
  const start = Math.max(0, hit - 90);
  const end = Math.min(content.length, hit + 170);
  const raw = content.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${raw}${end < content.length ? "…" : ""}`;
}

interface SearchCandidate {
  kind: SearchKind;
  file: string;
  book?: string;
  book_title?: string;
  title: string;
  log_file?: string;
}

export function createVaultService(
  reader: VaultReader,
  options: VaultServiceOptions = {},
): VaultService {
  async function readMarkdown(relativePath: string): Promise<MarkdownDocument | null> {
    try {
      return reader.parseMarkdown(await reader.readText(relativePath));
    } catch (error) {
      if (options.strict) throw error;
      return null;
    }
  }

  async function listBookDirs(): Promise<string[]> {
    try {
      const entries = await reader.readDir("books");
      const directories = entries
        .filter(
          (entry) =>
            entry.isDirectory &&
            !entry.name.startsWith(".") &&
            !entry.name.startsWith("._"),
        )
        .map((entry) => entry.name);
      const recognised = await Promise.all(
        directories.map(async (name) => ({
          name,
          hasMetadata: await reader.exists(vaultPath("books", name, "book.md")),
        })),
      );
      return recognised
        .filter((entry) => entry.hasMetadata)
        .map((entry) => entry.name);
    } catch (error) {
      if (options.strict) throw error;
      return [];
    }
  }

  async function listMarkdown(relativeDir: string): Promise<string[]> {
    try {
      return (await reader.readDir(relativeDir))
        .filter((entry) => entry.isFile && isVisibleMarkdown(entry.name))
        .map((entry) => entry.name);
    } catch {
      return [];
    }
  }

  async function readSessionLogs(bookDir: string, slug: string): Promise<SessionLog[]> {
    const files = await listMarkdown(vaultPath(bookDir, "logs"));
    const logs: SessionLog[] = [];
    for (const file of files) {
      const markdown = await readMarkdown(vaultPath(bookDir, "logs", file));
      if (!markdown) continue;
      logs.push({
        path: `logs/${file}`,
        date: asString(markdown.data.date),
        book: asString(markdown.data.book, slug),
        segment:
          typeof markdown.data.segment === "string" ? markdown.data.segment : undefined,
        type: asString(markdown.data.type, "session"),
        duration_approx:
          typeof markdown.data.duration_approx === "string"
            ? markdown.data.duration_approx
            : undefined,
        summary: markdown.content.trim().slice(0, 400),
        outcomes: normaliseOutcomes(markdown.data.outcomes),
      });
    }
    return logs.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  function summariseBook(meta: BookMeta, logs: SessionLog[]): BookSummary {
    const completed = meta.segments.filter((segment) =>
      COMPLETED_STAGES.includes(segment.stage),
    ).length;
    const total = meta.total_segments || meta.segments.length;
    return {
      ...meta,
      progress: { completed, total, last_active: logs[0]?.date },
    };
  }

  async function readBookBundle(
    slug: string,
  ): Promise<{ book: BookSummary; logs: SessionLog[] } | null> {
    const bookDir = vaultPath("books", slug);
    const markdown = await readMarkdown(vaultPath(bookDir, "book.md"));
    if (!markdown) return null;
    const logs = await readSessionLogs(bookDir, slug);
    return {
      book: summariseBook(parseBookMeta(markdown.data, slug), logs),
      logs,
    };
  }

  async function readBookSummary(slug: string): Promise<BookSummary | null> {
    return (await readBookBundle(slug))?.book ?? null;
  }

  async function readBookDetail(slug: string): Promise<BookDetail | null> {
    if (!SLUG_RE.test(slug)) return null;
    const bookDir = vaultPath("books", slug);
    const markdown = await readMarkdown(vaultPath(bookDir, "book.md"));
    if (!markdown) return null;
    const meta = parseBookMeta(markdown.data, slug);
    const logs = await readSessionLogs(bookDir, slug);
    return {
      ...summariseBook(meta, logs),
      body_html: await reader.renderMarkdown(markdown.content),
      logs,
      has_thesis: await reader.exists(vaultPath(bookDir, "thesis.md")),
      has_essay: await reader.exists(vaultPath(bookDir, "essay.md")),
    };
  }

  async function readWorkspaceData(): Promise<WorkspaceData> {
    const bundles = await Promise.all(
      (await listBookDirs()).map((slug) => readBookBundle(slug)),
    );
    const books: BookSummary[] = [];
    const logs: SessionLog[] = [];
    for (const bundle of bundles) {
      if (!bundle) continue;
      books.push(bundle.book);
      logs.push(...bundle.logs);
    }
    logs.sort((a, b) => (a.date < b.date ? 1 : -1));
    return { books, logs };
  }

  async function readAllBooks(): Promise<BookSummary[]> {
    return (await readWorkspaceData()).books;
  }

  async function readLogDetail(slug: string, file: string): Promise<LogDetail | null> {
    if (!SLUG_RE.test(slug) || !LOG_FILE_RE.test(file) || file.includes("..")) {
      return null;
    }
    const relativePath = vaultPath("books", slug, "logs", file);
    const markdown = await readMarkdown(relativePath);
    if (!markdown) return null;
    const bookMarkdown = await readMarkdown(vaultPath("books", slug, "book.md"));
    return {
      path: `logs/${file}`,
      date: asString(markdown.data.date),
      book: asString(markdown.data.book, slug),
      book_title: bookMarkdown
        ? asString(bookMarkdown.data.title, slug)
        : undefined,
      segment:
        typeof markdown.data.segment === "string" ? markdown.data.segment : undefined,
      type: asString(markdown.data.type, "session"),
      duration_approx:
        typeof markdown.data.duration_approx === "string"
          ? markdown.data.duration_approx
          : undefined,
      summary: markdown.content.trim().slice(0, 400),
      outcomes: normaliseOutcomes(markdown.data.outcomes),
      body_html: await reader.renderMarkdown(markdown.content),
    };
  }

  async function readAllLogs(): Promise<SessionLog[]> {
    const logs: SessionLog[] = [];
    for (const slug of await listBookDirs()) {
      logs.push(...(await readSessionLogs(vaultPath("books", slug), slug)));
    }
    return logs.sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  async function collectCandidates(): Promise<SearchCandidate[]> {
    const books = await readAllBooks();
    const candidates: SearchCandidate[] = [];

    for (const book of books) {
      const bookDir = vaultPath("books", book.slug);
      const base = { book: book.slug, book_title: book.title };
      candidates.push({
        ...base,
        kind: "book",
        file: vaultPath(bookDir, "book.md"),
        title: book.title,
      });

      const segmentTitle = (filename: string): string => {
        const stem = filename.replace(/\.md$/, "");
        const segment = book.segments.find(
          (item) => stem === `${item.id}-${item.slug}` || stem === item.slug,
        );
        return segment ? segment.title : humanise(filename);
      };

      for (const file of await listMarkdown(vaultPath(bookDir, "source"))) {
        candidates.push({
          ...base,
          kind: "source",
          file: vaultPath(bookDir, "source", file),
          title: segmentTitle(file),
        });
      }
      for (const file of await listMarkdown(vaultPath(bookDir, "logs"))) {
        candidates.push({
          ...base,
          kind: "log",
          file: vaultPath(bookDir, "logs", file),
          title: logTitle(file),
          log_file: file,
        });
      }
      for (const file of await listMarkdown(vaultPath(bookDir, "reconstructions"))) {
        candidates.push({
          ...base,
          kind: "reconstruction",
          file: vaultPath(bookDir, "reconstructions", file),
          title: segmentTitle(file),
        });
      }
      for (const file of await listMarkdown(vaultPath(bookDir, "cards"))) {
        candidates.push({
          ...base,
          kind: "cards",
          file: vaultPath(bookDir, "cards", file),
          title: humanise(file),
        });
      }
      for (const special of ["thesis", "essay"] as const) {
        candidates.push({
          ...base,
          kind: special,
          file: vaultPath(bookDir, `${special}.md`),
          title: `${book.title} — ${special}`,
        });
      }
    }

    for (const file of await listMarkdown("cross-book")) {
      candidates.push({
        kind: "cross-book",
        file: vaultPath("cross-book", file),
        title: humanise(file),
      });
    }
    return candidates;
  }

  async function search(query: string): Promise<SearchResult[]> {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((term) => term.length >= 2)
      .slice(0, 6);
    if (terms.length === 0) return [];

    const results: SearchResult[] = [];
    for (const candidate of await collectCandidates()) {
      let raw: string;
      try {
        const size = await reader.size(candidate.file);
        if (size === null || size > MAX_FILE_BYTES) continue;
        raw = await reader.readText(candidate.file);
      } catch {
        continue;
      }
      const content = reader.parseMarkdown(raw).content;
      const contentLower = content.toLowerCase();
      const titleLower = candidate.title.toLowerCase();
      let score = 0;
      let allPresent = true;
      for (const term of terms) {
        const hits =
          countOccurrences(contentLower, term) +
          TITLE_WEIGHT * countOccurrences(titleLower, term);
        if (hits === 0) allPresent = false;
        score += hits;
      }
      if (score === 0) continue;
      if (allPresent && terms.length > 1) score *= 2;
      results.push({
        kind: candidate.kind,
        file: candidate.file,
        book: candidate.book,
        book_title: candidate.book_title,
        title: candidate.title,
        snippet: makeSnippet(plainify(content), terms),
        score,
        log_file: candidate.log_file,
      });
    }
    return results.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
  }

  return {
    readBookSummary,
    readBookDetail,
    readWorkspaceData,
    readAllBooks,
    readLogDetail,
    readAllLogs,
    search,
  };
}
