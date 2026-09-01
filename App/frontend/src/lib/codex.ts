import { Channel, invoke } from "@tauri-apps/api/core";
import { isDesktopApp } from "./desktop";

export type JsonRpcId = number | string;

export interface CodexTextInput {
  type: "text";
  text: string;
  text_elements?: unknown[];
}

export interface CodexItem {
  id: string;
  type: string;
  text?: string;
  content?: CodexTextInput[];
  command?: string;
  cwd?: string;
  status?: string;
  aggregatedOutput?: string | null;
  exitCode?: number | null;
  summary?: string[];
  changes?: Array<{ path: string; kind: string; diff: string }>;
  server?: string;
  tool?: string;
  arguments?: unknown;
  result?: unknown;
  error?: unknown;
  [key: string]: unknown;
}

export interface CodexTurn {
  id: string;
  items: CodexItem[];
  status: "completed" | "interrupted" | "failed" | "inProgress";
  error: { message?: string } | null;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
}

export interface CodexThread {
  id: string;
  preview: string;
  name: string | null;
  cwd: string;
  createdAt: number;
  updatedAt: number;
  recencyAt: number | null;
  source: unknown;
  status: { type: string; activeFlags?: string[] };
  turns: CodexTurn[];
}

export interface CodexAccount {
  type: "apiKey" | "chatgpt" | "amazonBedrock";
  email?: string | null;
  planType?: string;
}

export interface AccountStatus {
  account: CodexAccount | null;
  requiresOpenaiAuth: boolean;
}

export interface CodexServerRequest {
  id: JsonRpcId;
  method:
    | "item/commandExecution/requestApproval"
    | "item/fileChange/requestApproval"
    | "item/permissions/requestApproval"
    | "item/tool/requestUserInput";
  params: Record<string, unknown>;
}

export type CodexClientEvent =
  | {
      type: "connection";
      status: "connecting" | "connected" | "disconnected" | "error";
      detail?: string;
    }
  | { type: "notification"; method: string; params: Record<string, unknown> }
  | { type: "serverRequest"; request: CodexServerRequest }
  | { type: "diagnostic"; message: string };

interface ProcessEvent {
  stream: "stdout" | "stderr" | "bridgeError" | "exit";
  line: string;
}

interface ProcessStartResult {
  executable: string;
}

interface JsonRpcResponse {
  id: JsonRpcId;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

interface JsonRpcMessage {
  id?: JsonRpcId;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

type PendingRequest = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
};

const SUPPORTED_SERVER_REQUESTS = new Set<CodexServerRequest["method"]>([
  "item/commandExecution/requestApproval",
  "item/fileChange/requestApproval",
  "item/permissions/requestApproval",
  "item/tool/requestUserInput",
]);

function messageFromError(error: JsonRpcResponse["error"]): string {
  if (!error) return "Codex returned an unknown protocol error";
  return error.message ?? `Codex protocol error ${error.code ?? "unknown"}`;
}

function parentPath(path: string): string | null {
  const normalized = path.replaceAll("\\", "/").replace(/\/+$/, "");
  const separator = normalized.lastIndexOf("/");
  if (separator <= 0) return null;
  return normalized.slice(0, separator);
}

export function threadCwdsForWorkspace(workspacePath: string): string[] {
  const normalized = workspacePath.replaceAll("\\", "/").replace(/\/+$/, "");
  const leaf = normalized.split("/").filter(Boolean).at(-1);
  const parent = parentPath(normalized);
  if ((leaf === "Learning" || leaf === "Learning.example") && parent) {
    return [normalized, parent];
  }
  return [normalized];
}

class CodexClient {
  private nextId = 1;
  private pending = new Map<JsonRpcId, PendingRequest>();
  private serverRequests = new Map<JsonRpcId, CodexServerRequest>();
  private loadedThreads = new Set<string>();
  private listeners = new Set<(event: CodexClientEvent) => void>();
  private connectPromise: Promise<void> | null = null;
  private connected = false;
  private processChannel: Channel<ProcessEvent> | null = null;
  private executable: string | null = null;

  subscribe(listener: (event: CodexClientEvent) => void): () => void {
    this.listeners.add(listener);
    if (this.connected) {
      listener({
        type: "connection",
        status: "connected",
        detail: this.executable ?? undefined,
      });
    }
    for (const request of this.serverRequests.values()) {
      listener({ type: "serverRequest", request });
    }
    return () => this.listeners.delete(listener);
  }

  private emit(event: CodexClientEvent) {
    for (const listener of this.listeners) listener(event);
  }

  async connect(): Promise<void> {
    if (!isDesktopApp()) {
      throw new Error("Codex chat is available in the desktop app.");
    }
    if (this.connected) return;
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.openConnection();
    try {
      await this.connectPromise;
    } catch (error) {
      this.connectPromise = null;
      throw error;
    }
  }

  private async openConnection(): Promise<void> {
    this.emit({ type: "connection", status: "connecting" });
    if (this.processChannel) {
      throw new Error("The Codex process channel is already open.");
    }
    const channel = new Channel<ProcessEvent>();
    channel.onmessage = (event) => this.handleProcessEvent(event);
    this.processChannel = channel;

    try {
      const started = await invoke<ProcessStartResult>("codex_start", {
        onEvent: channel,
      });
      this.executable = started.executable;
      await this.request("initialize", {
        clientInfo: {
          name: "ignite",
          title: "Ignite",
          version: "0.1.0",
        },
        capabilities: {
          experimentalApi: true,
          requestAttestation: false,
          mcpServerOpenaiFormElicitation: false,
        },
      });
      await this.notify("initialized");
      this.connected = true;
      this.emit({
        type: "connection",
        status: "connected",
        detail: this.executable,
      });
    } catch (error) {
      const detail = String(error);
      await invoke("codex_stop").catch(() => undefined);
      this.processChannel = null;
      this.loadedThreads.clear();
      this.serverRequests.clear();
      this.rejectPending(error instanceof Error ? error : new Error(detail));
      this.emit({ type: "connection", status: "error", detail });
      throw error;
    }
  }

  private handleProcessEvent(event: ProcessEvent) {
    if (event.stream === "stdout") {
      this.handleProtocolLine(event.line);
      return;
    }
    if (event.stream === "stderr") {
      console.warn(`[codex] ${event.line}`);
      return;
    }

    this.emit({ type: "diagnostic", message: event.line });
    if (event.stream === "bridgeError") {
      this.resetConnection(new Error(event.line));
      this.emit({ type: "connection", status: "error", detail: event.line });
      void invoke("codex_stop").catch(() => undefined);
      return;
    }
    if (event.stream === "exit") {
      this.resetConnection(new Error(event.line));
      this.emit({ type: "connection", status: "disconnected", detail: event.line });
    }
  }

  private resetConnection(error: Error) {
    this.connected = false;
    this.connectPromise = null;
    this.processChannel = null;
    this.loadedThreads.clear();
    this.serverRequests.clear();
    this.rejectPending(error);
  }

  private handleProtocolLine(line: string) {
    let message: JsonRpcMessage;
    try {
      message = JSON.parse(line) as JsonRpcMessage;
    } catch {
      this.emit({
        type: "diagnostic",
        message: `Codex sent a non-JSON protocol line: ${line}`,
      });
      return;
    }

    if (message.id !== undefined && message.method === undefined) {
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(messageFromError(message.error)));
      else request.resolve(message.result);
      return;
    }

    if (message.method && message.id !== undefined) {
      if (message.method === "currentTime/read") {
        void this.send({
          id: message.id,
          result: { currentTimeAt: Math.floor(Date.now() / 1000) },
        }).catch((error: unknown) => {
          this.emit({
            type: "diagnostic",
            message: `Could not answer ${message.method}: ${String(error)}`,
          });
        });
        return;
      }
      if (SUPPORTED_SERVER_REQUESTS.has(message.method as CodexServerRequest["method"])) {
        const request: CodexServerRequest = {
          id: message.id,
          method: message.method as CodexServerRequest["method"],
          params: message.params ?? {},
        };
        this.serverRequests.set(message.id, request);
        this.emit({
          type: "serverRequest",
          request,
        });
      } else {
        void this.rejectServerRequest(
          message.id,
          `This client does not implement the server request ${message.method}`,
        ).catch((error: unknown) => {
          this.emit({
            type: "diagnostic",
            message: `Could not reject ${message.method}: ${String(error)}`,
          });
        });
      }
      return;
    }

    if (message.method) {
      if (
        message.method === "serverRequest/resolved" &&
        (typeof message.params?.requestId === "string" ||
          typeof message.params?.requestId === "number")
      ) {
        this.serverRequests.delete(message.params.requestId);
      }
      this.emit({
        type: "notification",
        method: message.method,
        params: message.params ?? {},
      });
    }
  }

  private rejectPending(error: Error) {
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }

  private async send(message: Record<string, unknown>) {
    await invoke("codex_send", { line: JSON.stringify(message) });
  }

  private request<T>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: (result) => resolve(result as T),
        reject,
      });
      void this.send({ method, id, params }).catch((error: unknown) => {
        this.pending.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }

  private notify(method: string): Promise<void> {
    return this.send({ method });
  }

  async account(): Promise<AccountStatus> {
    await this.connect();
    return this.request<AccountStatus>("account/read", { refreshToken: false });
  }

  async listThreads(workspacePath: string): Promise<CodexThread[]> {
    await this.connect();
    const threads: CodexThread[] = [];
    let cursor: string | null = null;

    do {
      const page: {
        data: CodexThread[];
        nextCursor: string | null;
      } = await this.request("thread/list", {
        cursor,
        limit: 100,
        sortKey: "recency_at",
        sortDirection: "desc",
        sourceKinds: ["cli", "vscode", "appServer"],
        archived: false,
        cwd: threadCwdsForWorkspace(workspacePath),
      });
      threads.push(...page.data);
      cursor = page.nextCursor;
    } while (cursor && threads.length < 500);

    return threads;
  }

  async readThread(threadId: string): Promise<CodexThread> {
    await this.connect();
    const response = await this.request<{ thread: CodexThread }>("thread/read", {
      threadId,
      includeTurns: true,
    });
    return response.thread;
  }

  async startThread(workspacePath: string): Promise<CodexThread> {
    await this.connect();
    const response = await this.request<{ thread: CodexThread }>("thread/start", {
      cwd: workspacePath,
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      sandbox: "workspace-write",
    });
    this.loadedThreads.add(response.thread.id);
    return response.thread;
  }

  async resumeThread(threadId: string, workspacePath: string): Promise<CodexThread> {
    await this.connect();
    const response = await this.request<{ thread: CodexThread }>("thread/resume", {
      threadId,
      cwd: workspacePath,
      approvalPolicy: "on-request",
      approvalsReviewer: "user",
      sandbox: "workspace-write",
    });
    this.loadedThreads.add(response.thread.id);
    return response.thread;
  }

  hasLoadedThread(threadId: string): boolean {
    return this.loadedThreads.has(threadId);
  }

  async startTurn(
    threadId: string,
    workspacePath: string,
    text: string,
  ): Promise<CodexTurn> {
    await this.connect();
    const response = await this.request<{ turn: CodexTurn }>("turn/start", {
      threadId,
      cwd: workspacePath,
      approvalPolicy: "on-request",
      input: [{ type: "text", text, text_elements: [] }],
    });
    return response.turn;
  }

  async interruptTurn(threadId: string, turnId: string): Promise<void> {
    await this.connect();
    await this.request("turn/interrupt", { threadId, turnId });
  }

  async respondToServerRequest(id: JsonRpcId, result: unknown): Promise<void> {
    await this.send({ id, result });
    this.serverRequests.delete(id);
  }

  async rejectServerRequest(id: JsonRpcId, message: string): Promise<void> {
    await this.send({ id, error: { code: -32601, message } });
    this.serverRequests.delete(id);
  }
}

export const codexClient = new CodexClient();
