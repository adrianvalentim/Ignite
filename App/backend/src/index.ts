import Fastify from "fastify";
import cors from "@fastify/cors";
import chokidar from "chokidar";
import path from "node:path";
import {
  loadConfig,
  readAllBooks,
  readAllLogs,
  readBookDetail,
} from "./workspace.js";

const PORT = Number(process.env.PORT) || 3333;

const config = await loadConfig();
console.log(`[workspace] ${config.workspace_path}`);

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

app.get("/api/health", async () => ({
  ok: true,
  workspace: config.workspace_path,
}));

app.get("/api/books", async () => {
  const books = await readAllBooks(config.workspace_path);
  return { books };
});

app.get<{ Params: { slug: string } }>("/api/books/:slug", async (req, reply) => {
  const detail = await readBookDetail(config.workspace_path, req.params.slug);
  if (!detail) return reply.code(404).send({ error: "not found" });
  return detail;
});

app.get("/api/timeline", async () => {
  const logs = await readAllLogs(config.workspace_path);
  return { logs };
});

// Filesystem-change stream via Server-Sent Events.
// Frontend can subscribe and silently refetch when something on disk changes.
const sseClients = new Set<{ write: (chunk: string) => void; end: () => void }>();

app.get("/api/events", async (_req, reply) => {
  reply.raw.setHeader("Content-Type", "text/event-stream");
  reply.raw.setHeader("Cache-Control", "no-cache");
  reply.raw.setHeader("Connection", "keep-alive");
  reply.raw.write(": connected\n\n");

  const client = {
    write: (chunk: string) => reply.raw.write(chunk),
    end: () => reply.raw.end(),
  };
  sseClients.add(client);
  reply.raw.on("close", () => sseClients.delete(client));

  // Keep the connection alive across proxies.
  const heartbeat = setInterval(() => {
    try {
      reply.raw.write(": ping\n\n");
    } catch {
      /* socket may be gone */
    }
  }, 25_000);
  reply.raw.on("close", () => clearInterval(heartbeat));
});

function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      /* drop */
    }
  }
}

// Watch the workspace for changes to any book.md / log / connection file.
const watcher = chokidar.watch(
  [
    path.join(config.workspace_path, "books"),
    path.join(config.workspace_path, "cross-book"),
  ],
  {
    ignoreInitial: true,
    ignored: (p) => p.includes("/.") || p.endsWith(".swp"),
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
  },
);

let debounce: NodeJS.Timeout | null = null;
watcher.on("all", (event, file) => {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => {
    broadcast("workspace-changed", { event, file });
  }, 120);
});

try {
  await app.listen({ port: PORT, host: "127.0.0.1" });
  console.log(`[backend] http://127.0.0.1:${PORT}`);
} catch (err) {
  console.error(err);
  process.exit(1);
}
