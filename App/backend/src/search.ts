import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { SearchKind, SearchResult } from "../../shared/types.js";
import { readAllBooks } from "./workspace.js";

// ---------------------------------------------------------------------------
// Dependency-free full-text search over the vault's markdown. A personal
// vault is small (megabytes at most), so a straight scan per query is
// simpler and more trustworthy than maintaining an index that can go stale.

const MAX_RESULTS = 20;
const MAX_FILE_BYTES = 512 * 1024;
const TITLE_WEIGHT = 6;

interface Candidate {
  kind: SearchKind;
  file: string;
  absPath: string;
  book?: string;
  book_title?: string;
  title: string;
  log_file?: string;
}

function isVisibleMarkdown(name: string): boolean {
  return name.endsWith(".md") && !name.startsWith(".") && !name.startsWith("._");
}

async function listMarkdown(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && isVisibleMarkdown(e.name))
      .map((e) => e.name);
  } catch {
    return [];
  }
}

function humanise(filename: string): string {
  return filename
    .replace(/\.md$/, "")
    .replace(/^\d+[-.]?/, "")
    .replace(/-/g, " ")
    .replace(/(^|\s)\w/g, (c) => c.toUpperCase())
    .trim();
}

/** "2026-01-24-recall-loops.md" → "Recall Loops — 2026-01-24" */
function logTitle(filename: string): string {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})-(.+)\.md$/);
  if (!m) return humanise(filename);
  return `${humanise(`${m[2]}.md`)} — ${m[1]}`;
}

async function collectCandidates(workspace: string): Promise<Candidate[]> {
  const books = await readAllBooks(workspace);
  const out: Candidate[] = [];

  for (const book of books) {
    const bookDir = path.join(workspace, "books", book.slug);
    const base = { book: book.slug, book_title: book.title };

    out.push({
      ...base,
      kind: "book",
      file: `books/${book.slug}/book.md`,
      absPath: path.join(bookDir, "book.md"),
      title: book.title,
    });

    const segmentTitle = (filename: string): string => {
      const stem = filename.replace(/\.md$/, "");
      const seg = book.segments.find(
        (s) => stem === `${s.id}-${s.slug}` || stem === s.slug,
      );
      return seg ? seg.title : humanise(filename);
    };

    for (const f of await listMarkdown(path.join(bookDir, "source"))) {
      out.push({
        ...base,
        kind: "source",
        file: `books/${book.slug}/source/${f}`,
        absPath: path.join(bookDir, "source", f),
        title: segmentTitle(f),
      });
    }
    for (const f of await listMarkdown(path.join(bookDir, "logs"))) {
      out.push({
        ...base,
        kind: "log",
        file: `books/${book.slug}/logs/${f}`,
        absPath: path.join(bookDir, "logs", f),
        title: logTitle(f),
        log_file: f,
      });
    }
    for (const f of await listMarkdown(path.join(bookDir, "reconstructions"))) {
      out.push({
        ...base,
        kind: "reconstruction",
        file: `books/${book.slug}/reconstructions/${f}`,
        absPath: path.join(bookDir, "reconstructions", f),
        title: segmentTitle(f),
      });
    }
    for (const f of await listMarkdown(path.join(bookDir, "cards"))) {
      out.push({
        ...base,
        kind: "cards",
        file: `books/${book.slug}/cards/${f}`,
        absPath: path.join(bookDir, "cards", f),
        title: humanise(f),
      });
    }
    for (const special of ["thesis", "essay"] as const) {
      out.push({
        ...base,
        kind: special,
        file: `books/${book.slug}/${special}.md`,
        absPath: path.join(bookDir, `${special}.md`),
        title: `${book.title} — ${special}`,
      });
    }
  }

  const crossDir = path.join(workspace, "cross-book");
  for (const f of await listMarkdown(crossDir)) {
    out.push({
      kind: "cross-book",
      file: `cross-book/${f}`,
      absPath: path.join(crossDir, f),
      title: humanise(f),
    });
  }

  return out;
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = 0;
  while (count < 50) {
    idx = haystack.indexOf(needle, idx);
    if (idx === -1) break;
    count++;
    idx += needle.length;
  }
  return count;
}

/** Flatten markdown to plain-ish text so snippets read as prose. */
function plainify(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/^[-+]\s+/gm, "");
}

function makeSnippet(content: string, terms: string[]): string {
  const lower = content.toLowerCase();
  let hit = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (hit === -1 || idx < hit)) hit = idx;
  }
  if (hit === -1) hit = 0;
  const start = Math.max(0, hit - 90);
  const end = Math.min(content.length, hit + 170);
  const raw = content.slice(start, end).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${raw}${end < content.length ? "…" : ""}`;
}

export async function searchWorkspace(
  workspace: string,
  query: string,
): Promise<SearchResult[]> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  if (terms.length === 0) return [];

  const candidates = await collectCandidates(workspace);
  const results: SearchResult[] = [];

  for (const cand of candidates) {
    let raw: string;
    try {
      const stat = await fs.stat(cand.absPath);
      if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
      raw = await fs.readFile(cand.absPath, "utf8");
    } catch {
      continue;
    }
    const content = matter(raw).content;
    const contentLower = content.toLowerCase();
    const titleLower = cand.title.toLowerCase();

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
      kind: cand.kind,
      file: cand.file,
      book: cand.book,
      book_title: cand.book_title,
      title: cand.title,
      snippet: makeSnippet(plainify(content), terms),
      score,
      log_file: cand.log_file,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, MAX_RESULTS);
}
