import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildStats } from "../dist/backend/src/stats.js";
import { buildSnapshot } from "../dist/backend/src/snapshot.js";
import { buildToday } from "../dist/backend/src/schedule.js";
import { searchWorkspace } from "../dist/backend/src/search.js";
import { createRefreshCoordinator } from "../dist/shared/refresh.js";
import { buildTodayFrom } from "../dist/shared/schedule.js";
import { buildStatsFrom } from "../dist/shared/stats.js";
import { createVaultService } from "../dist/shared/vault.js";
import {
  readAllBooks,
  readAllLogs,
  readBookDetail,
  readLogDetail,
  readWorkspaceData,
} from "../dist/backend/src/workspace.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const workspace = path.resolve(here, "../../../Learning.example");

test("the shared vault core reads the public workspace end to end", async () => {
  const books = await readAllBooks(workspace);
  const logs = await readAllLogs(workspace);
  const detail = await readBookDetail(workspace, books[0].slug);
  const firstLog = logs[0];
  const logDetail = await readLogDetail(
    workspace,
    firstLog.book,
    firstLog.path.replace("logs/", ""),
  );
  const [today, stats, search] = await Promise.all([
    buildToday(workspace),
    buildStats(workspace),
    searchWorkspace(workspace, "feedback"),
  ]);

  assert.equal(books.length, 2);
  assert.equal(logs.length, 5);
  assert.ok(detail?.body_html.includes("<"));
  assert.ok(logDetail?.body_html.includes("<"));
  assert.equal(today.pipeline.length, 2);
  assert.equal(stats.totals.sessions, logs.length);
  assert.deepEqual(
    search.map(({ kind, title, score }) => ({ kind, title, score })),
    [
      { kind: "book", title: "Systems and Feedback", score: 9 },
      { kind: "source", title: "Feedback Loops", score: 8 },
      { kind: "log", title: "Reconstruction Loops — 2026-01-11", score: 1 },
      { kind: "log", title: "Recall Loops — 2026-01-24", score: 1 },
      { kind: "cross-book", title: "Connections", score: 1 },
    ],
  );
});

test("log paths cannot escape the selected workspace", async () => {
  assert.equal(
    await readLogDetail(workspace, "clear-thinking-primer", "../book.md"),
    null,
  );
});

test("one workspace snapshot matches the focused readers", async () => {
  const todayISO = "2026-02-01";
  const [data, books, logs, snapshot] = await Promise.all([
    readWorkspaceData(workspace),
    readAllBooks(workspace),
    readAllLogs(workspace),
    buildSnapshot(workspace, todayISO),
  ]);

  assert.deepEqual(data.books, books);
  assert.deepEqual(data.logs, logs);
  assert.deepEqual(snapshot.books, books);
  assert.deepEqual(snapshot.logs, logs);
  assert.deepEqual(snapshot.today, buildTodayFrom(books, logs, todayISO));
  assert.deepEqual(snapshot.stats, buildStatsFrom(books, logs, todayISO));
});

test("a workspace snapshot reads each metadata and log file once", async () => {
  const files = new Map([
    [
      "books/real-book/book.md",
      JSON.stringify({
        data: {
          title: "Real Book",
          slug: "real-book",
          status: "active",
          segments: [],
        },
        content: "",
      }),
    ],
    [
      "books/real-book/logs/2026-01-01-session.md",
      JSON.stringify({
        data: { date: "2026-01-01", book: "real-book", type: "reading" },
        content: "One session.",
      }),
    ],
  ]);
  const reads = new Map();
  const reader = {
    async readText(relativePath) {
      reads.set(relativePath, (reads.get(relativePath) ?? 0) + 1);
      const raw = files.get(relativePath);
      if (!raw) throw new Error(`Unexpected read: ${relativePath}`);
      return raw;
    },
    async readDir(relativePath) {
      if (relativePath === "books") {
        return [
          { name: "real-book", isFile: false, isDirectory: true },
          { name: "notes", isFile: false, isDirectory: true },
        ];
      }
      if (relativePath === "books/real-book/logs") {
        return [
          {
            name: "2026-01-01-session.md",
            isFile: true,
            isDirectory: false,
          },
        ];
      }
      throw new Error(`Missing optional directory: ${relativePath}`);
    },
    async exists(relativePath) {
      return relativePath === "books/real-book/book.md";
    },
    async size() {
      return null;
    },
    parseMarkdown(raw) {
      return JSON.parse(raw);
    },
    async renderMarkdown(markdown) {
      return markdown;
    },
  };

  const data = await createVaultService(reader, { strict: true }).readWorkspaceData();

  assert.deepEqual(data.books.map((book) => book.slug), ["real-book"]);
  assert.equal(data.logs.length, 1);
  assert.deepEqual(Object.fromEntries(reads), {
    "books/real-book/book.md": 1,
    "books/real-book/logs/2026-01-01-session.md": 1,
  });
});

test("search reuses an invalidatable index and bounds parallel file work", async () => {
  const sourceFiles = Array.from(
    { length: 24 },
    (_, index) => `${String(index + 1).padStart(2, "0")}-source.md`,
  );
  const logFile = "2026-01-01-session.md";
  const files = new Map([
    [
      "books/real-book/book.md",
      JSON.stringify({
        data: {
          title: "Real Book",
          slug: "real-book",
          status: "active",
          segments: [],
        },
        content: "A quiet overview.",
      }),
    ],
    [
      `books/real-book/logs/${logFile}`,
      JSON.stringify({ data: {}, content: "Needle in the session log." }),
    ],
    ...sourceFiles.map((file, index) => [
      `books/real-book/source/${file}`,
      JSON.stringify({ data: {}, content: `Needle in source ${index + 1}.` }),
    ]),
  ]);
  const reads = new Map();
  let activeReads = 0;
  let maxActiveReads = 0;
  const reader = {
    async readText(relativePath) {
      reads.set(relativePath, (reads.get(relativePath) ?? 0) + 1);
      activeReads++;
      maxActiveReads = Math.max(maxActiveReads, activeReads);
      try {
        await new Promise((resolve) => setTimeout(resolve, 2));
        const raw = files.get(relativePath);
        if (!raw) throw new Error(`Unexpected read: ${relativePath}`);
        return raw;
      } finally {
        activeReads--;
      }
    },
    async readDir(relativePath) {
      if (relativePath === "books") {
        return [{ name: "real-book", isFile: false, isDirectory: true }];
      }
      if (relativePath === "books/real-book/source") {
        return sourceFiles.map((name) => ({ name, isFile: true, isDirectory: false }));
      }
      if (relativePath === "books/real-book/logs") {
        return [{ name: logFile, isFile: true, isDirectory: false }];
      }
      return [];
    },
    async exists(relativePath) {
      return relativePath === "books/real-book/book.md";
    },
    async size(relativePath) {
      const raw = files.get(relativePath);
      return raw ? Buffer.byteLength(raw) : null;
    },
    parseMarkdown(raw) {
      return JSON.parse(raw);
    },
    async renderMarkdown(markdown) {
      return markdown;
    },
  };

  const service = createVaultService(reader, { strict: true });
  const results = await service.search("needle");
  const readsAfterFirstSearch = [...reads.values()].reduce(
    (total, count) => total + count,
    0,
  );

  assert.equal(results.length, 20);
  assert.equal(reads.get(`books/real-book/logs/${logFile}`), 1);
  assert.ok(sourceFiles.every((file) => reads.get(`books/real-book/source/${file}`) === 1));
  assert.ok(maxActiveReads > 1);
  assert.ok(maxActiveReads <= 12);

  assert.equal((await service.search("source")).length, 20);
  assert.equal(
    [...reads.values()].reduce((total, count) => total + count, 0),
    readsAfterFirstSearch,
  );

  service.invalidate();
  await service.search("needle");
  assert.equal(reads.get(`books/real-book/logs/${logFile}`), 2);
});

test("refreshes are serialized and notifications coalesce into one trailing load", async () => {
  const gates = [];
  const successes = [];
  let calls = 0;
  let active = 0;
  let maxActive = 0;
  const coordinator = createRefreshCoordinator({
    async load() {
      const value = ++calls;
      active++;
      maxActive = Math.max(maxActive, active);
      let release;
      const waiting = new Promise((resolve) => {
        release = resolve;
      });
      gates.push(release);
      await waiting;
      active--;
      return value;
    },
    onSuccess(value) {
      successes.push(value);
    },
    onError(error) {
      assert.fail(String(error));
    },
  });

  coordinator.request();
  coordinator.request();
  coordinator.request();
  assert.equal(calls, 1);
  gates[0]();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls, 2);
  gates[1]();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(maxActive, 1);
  assert.equal(calls, 2);
  assert.deepEqual(successes, [1, 2]);
});

test("a failed refresh preserves the last complete snapshot", async () => {
  const initial = { books: ["complete"], logs: [], today: {}, stats: {} };
  let displayed = null;
  let error = null;
  let call = 0;
  const coordinator = createRefreshCoordinator({
    async load() {
      call++;
      if (call === 1) return initial;
      throw new Error("snapshot failed");
    },
    onSuccess(value) {
      displayed = value;
    },
    onError(nextError) {
      error = nextError;
    },
  });

  coordinator.request();
  await new Promise((resolve) => setImmediate(resolve));
  coordinator.request();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(displayed, initial);
  assert.match(String(error), /snapshot failed/);
});

test("disposing a refresh coordinator suppresses stale state updates", async () => {
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  const successes = [];
  const coordinator = createRefreshCoordinator({
    async load() {
      await waiting;
      return "stale";
    },
    onSuccess(value) {
      successes.push(value);
    },
    onError(error) {
      assert.fail(String(error));
    },
  });

  coordinator.request();
  coordinator.dispose();
  release();
  await new Promise((resolve) => setImmediate(resolve));
  coordinator.request();

  assert.deepEqual(successes, []);
});

test("book shelves ignore folders that do not contain book metadata", async () => {
  const reader = {
    async readText(relativePath) {
      if (relativePath === "books/real-book/book.md") {
        return [
          "---",
          "title: Real Book",
          "slug: real-book",
          "status: queued",
          "---",
          "",
        ].join("\n");
      }
      throw new Error(`Unexpected read: ${relativePath}`);
    },
    async readDir(relativePath) {
      if (relativePath === "books") {
        return [
          { name: "real-book", isFile: false, isDirectory: true },
          { name: "research-notes", isFile: false, isDirectory: true },
        ];
      }
      throw new Error(`Missing directory: ${relativePath}`);
    },
    async exists(relativePath) {
      return relativePath === "books/real-book/book.md";
    },
    async size() {
      return null;
    },
    parseMarkdown(raw) {
      return {
        data: { title: "Real Book", slug: "real-book", status: "queued" },
        content: raw,
      };
    },
    async renderMarkdown(markdown) {
      return markdown;
    },
  };

  const service = createVaultService(reader, { strict: true });
  const books = await service.readAllBooks();
  const search = await service.search("real");

  assert.deepEqual(books.map((book) => book.slug), ["real-book"]);
  assert.deepEqual(search, []);
});
