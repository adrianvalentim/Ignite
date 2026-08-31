import { isTauri } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import {
  exists,
  readDir,
  readTextFile,
  stat,
  watch,
  type UnwatchFn,
  type WatchEvent,
} from "@tauri-apps/plugin-fs";
import { marked } from "marked";
import { parse as parseYaml } from "yaml";
import { buildTodayFrom, localToday } from "@shared/schedule";
import { buildStatsFrom } from "@shared/stats";
import {
  createVaultService,
  type VaultReader,
  type VaultService,
} from "@shared/vault";
import { buildWorkspaceSnapshot } from "@shared/snapshot";

const WORKSPACE_KEY = "ignite.workspace";
const LEGACY_WORKSPACE_KEY = "effortful-learning.workspace";
const FRONTMATTER = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/;

export const isDesktopApp = (): boolean => isTauri();

export function currentWorkspace(): string | null {
  if (!isDesktopApp()) return null;
  const workspace =
    localStorage.getItem(WORKSPACE_KEY) ?? localStorage.getItem(LEGACY_WORKSPACE_KEY);
  if (workspace && !localStorage.getItem(WORKSPACE_KEY)) {
    localStorage.setItem(WORKSPACE_KEY, workspace);
  }
  return workspace;
}

let cachedRoot: string | null = null;
let cachedService: VaultService | null = null;

function parseMarkdownFile(raw: string) {
  const match = raw.match(FRONTMATTER);
  if (!match) return { data: {}, content: raw };
  const parsed = parseYaml(match[1]);
  return {
    data:
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : {},
    content: raw.slice(match[0].length),
  };
}

function safeSegments(relativePath: string): string[] {
  if (relativePath.startsWith("/") || relativePath.includes("\\")) {
    throw new Error("Vault paths must be relative");
  }
  const segments = relativePath.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("Vault path escapes the selected workspace");
  }
  return segments;
}

function createDesktopReader(root: string): VaultReader {
  async function resolveRelative(relativePath: string): Promise<string> {
    return join(root, ...safeSegments(relativePath));
  }

  return {
    async readText(relativePath) {
      return readTextFile(await resolveRelative(relativePath));
    },
    async readDir(relativePath) {
      return (await readDir(await resolveRelative(relativePath))).map((entry) => ({
        name: entry.name,
        isFile: entry.isFile,
        isDirectory: entry.isDirectory,
      }));
    },
    async exists(relativePath) {
      return exists(await resolveRelative(relativePath));
    },
    async size(relativePath) {
      try {
        const info = await stat(await resolveRelative(relativePath));
        return info.isFile ? info.size : null;
      } catch {
        return null;
      }
    },
    parseMarkdown(raw) {
      return parseMarkdownFile(raw);
    },
    async renderMarkdown(markdown) {
      const html = await marked.parse(markdown);
      return typeof html === "string" ? html : "";
    },
  };
}

function service(): VaultService {
  const root = currentWorkspace();
  if (!root) throw new Error("Choose a Learning workspace to continue.");
  if (root !== cachedRoot || !cachedService) {
    cachedRoot = root;
    cachedService = createVaultService(createDesktopReader(root), { strict: true });
  }
  return cachedService;
}

export async function chooseWorkspace(): Promise<string | null> {
  const selection = await open({
    title: "Choose your Learning workspace",
    directory: true,
    multiple: false,
    recursive: true,
  });
  if (typeof selection !== "string") return null;

  const reader = createDesktopReader(selection);
  if (!(await reader.exists("books"))) {
    throw new Error("That folder is not a Learning workspace: the books folder is missing.");
  }

  localStorage.setItem(WORKSPACE_KEY, selection);
  cachedRoot = null;
  cachedService = null;
  return selection;
}

export const desktopApi = {
  async snapshot() {
    const data = await service().readWorkspaceData();
    return buildWorkspaceSnapshot(data, localToday());
  },
  books: () => service().readAllBooks(),
  book: (slug: string) => service().readBookDetail(slug),
  timeline: () => service().readAllLogs(),
  async today() {
    const { books, logs } = await service().readWorkspaceData();
    return buildTodayFrom(books, logs, localToday());
  },
  async stats() {
    const { books, logs } = await service().readWorkspaceData();
    return buildStatsFrom(books, logs, localToday());
  },
  log: (book: string, file: string) => service().readLogDetail(book, file),
  search: (query: string) => service().search(query),
};

export async function subscribeDesktopWorkspace(
  onChange: () => void,
): Promise<() => void> {
  const root = currentWorkspace();
  if (!root) return () => undefined;

  try {
    const candidates = await Promise.all(
      ["books", "cross-book"].map(async (relativePath) => {
        const absolutePath = await join(root, relativePath);
        return (await exists(absolutePath)) ? absolutePath : null;
      }),
    );
    const roots = candidates.filter((path): path is string => path !== null);
    if (roots.length === 0) return () => undefined;

    let debounce: number | null = null;
    const unwatch: UnwatchFn = await watch(
      roots,
      (_event: WatchEvent) => {
        if (cachedRoot === root) cachedService?.invalidate();
        if (debounce !== null) window.clearTimeout(debounce);
        debounce = window.setTimeout(onChange, 120);
      },
      { recursive: true, delayMs: 200 },
    );

    return () => {
      if (debounce !== null) window.clearTimeout(debounce);
      void unwatch();
    };
  } catch (error: unknown) {
    console.error("Could not watch the Learning workspace", error);
    return () => undefined;
  }
}
