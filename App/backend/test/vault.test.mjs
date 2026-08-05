import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildStats } from "../dist/backend/src/stats.js";
import { buildToday } from "../dist/backend/src/schedule.js";
import { searchWorkspace } from "../dist/backend/src/search.js";
import { createVaultService } from "../dist/shared/vault.js";
import {
  readAllBooks,
  readAllLogs,
  readBookDetail,
  readLogDetail,
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
  assert.ok(search.length > 0);
});

test("log paths cannot escape the selected workspace", async () => {
  assert.equal(
    await readLogDetail(workspace, "clear-thinking-primer", "../book.md"),
    null,
  );
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

  assert.deepEqual(books.map((book) => book.slug), ["real-book"]);
});
