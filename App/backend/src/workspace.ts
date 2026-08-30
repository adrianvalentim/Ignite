import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";
import {
  createVaultService,
  type VaultReader,
  type VaultService,
} from "../../shared/vault.js";

function resolveWorkspace(rawPath: string, baseDir = process.cwd()): string {
  if (rawPath.startsWith("~")) {
    return path.join(os.homedir(), rawPath.slice(1));
  }
  if (!path.isAbsolute(rawPath)) return path.resolve(baseDir, rawPath);
  return rawPath;
}

async function loadWorkspaceConfig(
  configPath: string,
): Promise<{ workspace_path: string }> {
  const raw = await fs.readFile(configPath, "utf8");
  const parsed = JSON.parse(raw) as { workspace_path?: unknown };
  const workspaceRoot = path.resolve(path.dirname(configPath), "..");
  const configuredPath =
    typeof parsed.workspace_path === "string"
      ? parsed.workspace_path
      : workspaceRoot;
  return { workspace_path: resolveWorkspace(configuredPath, workspaceRoot) };
}

export async function loadConfig(): Promise<{ workspace_path: string }> {
  const envPath = process.env.LEARNING_WORKSPACE;
  if (envPath) return { workspace_path: resolveWorkspace(envPath) };

  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const privateConfig = path.join(repoRoot, "Learning", ".system", "config.json");
  if (existsSync(privateConfig)) return loadWorkspaceConfig(privateConfig);

  const exampleConfig = path.join(
    repoRoot,
    "Learning.example",
    ".system",
    "config.json",
  );
  if (existsSync(exampleConfig)) return loadWorkspaceConfig(exampleConfig);

  return { workspace_path: resolveWorkspace("~/learning") };
}

function createNodeReader(workspace: string): VaultReader {
  const root = path.resolve(workspace);

  function resolveRelative(relativePath: string): string {
    const absolute = path.resolve(root, ...relativePath.split("/"));
    if (absolute !== root && !absolute.startsWith(`${root}${path.sep}`)) {
      throw new Error("Vault path escapes the selected workspace");
    }
    return absolute;
  }

  return {
    readText: (relativePath) => fs.readFile(resolveRelative(relativePath), "utf8"),
    async readDir(relativePath) {
      return (await fs.readdir(resolveRelative(relativePath), { withFileTypes: true })).map(
        (entry) => ({
          name: entry.name,
          isFile: entry.isFile(),
          isDirectory: entry.isDirectory(),
        }),
      );
    },
    async exists(relativePath) {
      try {
        await fs.access(resolveRelative(relativePath));
        return true;
      } catch {
        return false;
      }
    },
    async size(relativePath) {
      try {
        const info = await fs.stat(resolveRelative(relativePath));
        return info.isFile() ? info.size : null;
      } catch {
        return null;
      }
    },
    parseMarkdown(raw) {
      const parsed = matter(raw);
      return {
        data: parsed.data as Record<string, unknown>,
        content: parsed.content,
      };
    },
    async renderMarkdown(markdown) {
      const html = await marked.parse(markdown);
      return typeof html === "string" ? html : "";
    },
  };
}

const services = new Map<string, VaultService>();

export function serviceFor(workspace: string): VaultService {
  const key = path.resolve(workspace);
  let service = services.get(key);
  if (!service) {
    service = createVaultService(createNodeReader(key));
    services.set(key, service);
  }
  return service;
}

export function invalidateWorkspace(workspace: string) {
  services.get(path.resolve(workspace))?.invalidate();
}

export function readBookSummary(workspace: string, slug: string) {
  return serviceFor(workspace).readBookSummary(slug);
}

export function readBookDetail(workspace: string, slug: string) {
  return serviceFor(workspace).readBookDetail(slug);
}

export function readAllBooks(workspace: string) {
  return serviceFor(workspace).readAllBooks();
}

export function readWorkspaceData(workspace: string) {
  return serviceFor(workspace).readWorkspaceData();
}

export function readLogDetail(workspace: string, slug: string, file: string) {
  return serviceFor(workspace).readLogDetail(slug, file);
}

export function readAllLogs(workspace: string) {
  return serviceFor(workspace).readAllLogs();
}
