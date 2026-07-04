import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import matter from "gray-matter";
import { marked } from "marked";
import type {
  BookDetail,
  BookMeta,
  BookSummary,
  Segment,
  SegmentStage,
  SessionLog,
} from "../../shared/types.js";

const COMPLETED_STAGES: SegmentStage[] = ["complete"];

function resolveWorkspace(rawPath: string, baseDir = process.cwd()): string {
  if (rawPath.startsWith("~")) {
    return path.join(os.homedir(), rawPath.slice(1));
  }
  if (!path.isAbsolute(rawPath)) {
    return path.resolve(baseDir, rawPath);
  }
  return rawPath;
}

async function loadWorkspaceConfig(configPath: string): Promise<{ workspace_path: string }> {
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw);
  const workspaceRoot = path.resolve(path.dirname(configPath), "..");
  const configuredPath =
    typeof parsed.workspace_path === "string" ? parsed.workspace_path : workspaceRoot;
  return { workspace_path: resolveWorkspace(configuredPath, workspaceRoot) };
}

export async function loadConfig(): Promise<{ workspace_path: string }> {
  // Workspace resolution order:
  //   1. LEARNING_WORKSPACE env override
  //   2. private local ./Learning config
  //   3. public ./Learning.example demo config
  //   4. fallback ~/learning
  const envPath = process.env.LEARNING_WORKSPACE;
  if (envPath) {
    return { workspace_path: resolveWorkspace(envPath) };
  }

  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const privateConfig = path.join(
    repoRoot,
    "Learning",
    ".system",
    "config.json",
  );
  if (existsSync(privateConfig)) {
    return loadWorkspaceConfig(privateConfig);
  }

  const exampleConfig = path.join(
    repoRoot,
    "Learning.example",
    ".system",
    "config.json",
  );
  if (existsSync(exampleConfig)) {
    return loadWorkspaceConfig(exampleConfig);
  }

  // Fallback: ~/learning
  return { workspace_path: resolveWorkspace("~/learning") };
}

async function readMarkdown(absPath: string): Promise<{
  data: Record<string, unknown>;
  content: string;
} | null> {
  try {
    const raw = await fs.readFile(absPath, "utf8");
    const parsed = matter(raw);
    return { data: parsed.data as Record<string, unknown>, content: parsed.content };
  } catch {
    return null;
  }
}

function asString(v: unknown, fallback = ""): string {
  if (typeof v === "string") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return fallback;
}
function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function normaliseSegments(raw: unknown): Segment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((s, i) => {
    const obj = (s ?? {}) as Record<string, unknown>;
    return {
      id: asString(obj.id, String(i + 1).padStart(2, "0")),
      slug: asString(obj.slug, `segment-${i + 1}`),
      title: asString(obj.title, `Segment ${i + 1}`),
      summary: asString(obj.summary),
      stage: (asString(obj.stage, "unread") as SegmentStage),
      difficulty: asNumber(obj.difficulty, 0),
      sessions: asNumber(obj.sessions, 0),
    };
  });
}

function normaliseDifficultyMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number") out[k] = v;
  }
  return out;
}

function normaliseConnections(raw: unknown): BookMeta["connections"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const obj = (c ?? {}) as Record<string, unknown>;
      return {
        target_book: asString(obj.target_book),
        description: asString(obj.description),
      };
    })
    .filter((c) => c.target_book.length > 0);
}

function parseBookMeta(data: Record<string, unknown>, slug: string): BookMeta {
  return {
    title: asString(data.title, slug),
    author: asString(data.author),
    slug: asString(data.slug, slug),
    date_added: asString(data.date_added),
    date_started: asString(data.date_started) || undefined,
    date_completed: asString(data.date_completed) || undefined,
    status: (asString(data.status, "queued") as BookMeta["status"]),
    total_segments: asNumber(data.total_segments),
    segments: normaliseSegments(data.segments),
    difficulty_map: normaliseDifficultyMap(data.difficulty_map),
    connections: normaliseConnections(data.connections),
    cover: typeof data.cover === "string" ? data.cover : undefined,
  };
}

async function listBookDirs(workspace: string): Promise<string[]> {
  const booksDir = path.join(workspace, "books");
  try {
    const entries = await fs.readdir(booksDir, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isDirectory() &&
          !e.name.startsWith(".") &&
          !e.name.startsWith("._"),
      )
      .map((e) => e.name);
  } catch {
    return [];
  }
}

async function readSessionLogs(bookDir: string, slug: string): Promise<SessionLog[]> {
  const logsDir = path.join(bookDir, "logs");
  try {
    const entries = await fs.readdir(logsDir, { withFileTypes: true });
    const files = entries.filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith(".md") &&
        !e.name.startsWith(".") &&
        !e.name.startsWith("._"),
    );
    const logs: SessionLog[] = [];
    for (const f of files) {
      const md = await readMarkdown(path.join(logsDir, f.name));
      if (!md) continue;
      const data = md.data;
      logs.push({
        path: `logs/${f.name}`,
        date: asString(data.date),
        book: asString(data.book, slug),
        segment: typeof data.segment === "string" ? data.segment : undefined,
        type: asString(data.type, "session"),
        duration_approx:
          typeof data.duration_approx === "string" ? data.duration_approx : undefined,
        summary: md.content.trim().slice(0, 400),
      });
    }
    return logs.sort((a, b) => (a.date < b.date ? 1 : -1));
  } catch {
    return [];
  }
}

export async function readBookSummary(
  workspace: string,
  slug: string,
): Promise<BookSummary | null> {
  const bookDir = path.join(workspace, "books", slug);
  const md = await readMarkdown(path.join(bookDir, "book.md"));
  if (!md) return null;
  const meta = parseBookMeta(md.data, slug);
  const completed = meta.segments.filter((s) => COMPLETED_STAGES.includes(s.stage)).length;
  const total = meta.total_segments || meta.segments.length;
  const logs = await readSessionLogs(bookDir, slug);
  return {
    ...meta,
    progress: {
      completed,
      total,
      last_active: logs[0]?.date,
    },
  };
}

export async function readBookDetail(
  workspace: string,
  slug: string,
): Promise<BookDetail | null> {
  const bookDir = path.join(workspace, "books", slug);
  const md = await readMarkdown(path.join(bookDir, "book.md"));
  if (!md) return null;
  const meta = parseBookMeta(md.data, slug);
  const completed = meta.segments.filter((s) => COMPLETED_STAGES.includes(s.stage)).length;
  const total = meta.total_segments || meta.segments.length;
  const logs = await readSessionLogs(bookDir, slug);
  const body_html = await marked.parse(md.content);
  const has_thesis = existsSync(path.join(bookDir, "thesis.md"));
  const has_essay = existsSync(path.join(bookDir, "essay.md"));
  return {
    ...meta,
    progress: {
      completed,
      total,
      last_active: logs[0]?.date,
    },
    body_html: typeof body_html === "string" ? body_html : "",
    logs,
    has_thesis,
    has_essay,
  };
}

export async function readAllBooks(workspace: string): Promise<BookSummary[]> {
  const slugs = await listBookDirs(workspace);
  const out: BookSummary[] = [];
  for (const slug of slugs) {
    const s = await readBookSummary(workspace, slug);
    if (s) out.push(s);
  }
  return out;
}

export async function readAllLogs(workspace: string): Promise<SessionLog[]> {
  const slugs = await listBookDirs(workspace);
  const all: SessionLog[] = [];
  for (const slug of slugs) {
    const logs = await readSessionLogs(path.join(workspace, "books", slug), slug);
    all.push(...logs);
  }
  return all.sort((a, b) => (a.date < b.date ? 1 : -1));
}
