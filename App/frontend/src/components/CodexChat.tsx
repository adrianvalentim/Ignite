import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  codexClient,
  type AccountStatus,
  type CodexClientEvent,
  type CodexItem,
  type CodexServerRequest,
  type CodexThread,
  type CodexTurn,
} from "../lib/codex";
import { isDesktopApp } from "../lib/desktop";

interface Props {
  workspacePath: string | null;
}

type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected" | "error";

function upsertTurn(thread: CodexThread, turn: CodexTurn): CodexThread {
  const index = thread.turns.findIndex((candidate) => candidate.id === turn.id);
  const turns = [...thread.turns];
  if (index === -1) turns.push(turn);
  else turns[index] = turn;
  return { ...thread, turns };
}

function upsertItem(
  thread: CodexThread,
  turnId: string,
  item: CodexItem,
): CodexThread {
  const turn = thread.turns.find((candidate) => candidate.id === turnId);
  if (!turn) {
    return upsertTurn(thread, {
      id: turnId,
      items: [item],
      status: "inProgress",
      error: null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
    });
  }

  const itemIndex = turn.items.findIndex((candidate) => candidate.id === item.id);
  const items = [...turn.items];
  if (itemIndex === -1) items.push(item);
  else items[itemIndex] = item;
  return upsertTurn(thread, { ...turn, items });
}

function appendItemDelta(
  thread: CodexThread,
  turnId: string,
  itemId: string,
  field: "text" | "aggregatedOutput",
  delta: string,
): CodexThread {
  const turn = thread.turns.find((candidate) => candidate.id === turnId);
  const current = turn?.items.find((candidate) => candidate.id === itemId);
  const item: CodexItem = current
    ? { ...current, [field]: `${String(current[field] ?? "")}${delta}` }
    : {
        id: itemId,
        type: field === "text" ? "agentMessage" : "commandExecution",
        [field]: delta,
      };
  return upsertItem(thread, turnId, item);
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  return "Codex could not complete that operation.";
}

export function CodexChat({ workspacePath }: Props) {
  const desktop = isDesktopApp();
  const [connection, setConnection] = useState<ConnectionStatus>("idle");
  const [connectionDetail, setConnectionDetail] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [threads, setThreads] = useState<CodexThread[]>([]);
  const [activeThread, setActiveThread] = useState<CodexThread | null>(null);
  const [runningTurns, setRunningTurns] = useState<Record<string, string>>({});
  const [pendingRequests, setPendingRequests] = useState<CodexServerRequest[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [openingThreadId, setOpeningThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const runningTurnId = activeThread ? (runningTurns[activeThread.id] ?? null) : null;
  const threadBusy =
    runningTurnId !== null ||
    activeThread?.turns.some((turn) => turn.status === "inProgress") === true;

  const loadThreads = useCallback(async () => {
    if (!workspacePath || !desktop) return;
    setLoadingThreads(true);
    try {
      setThreads(await codexClient.listThreads(workspacePath));
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoadingThreads(false);
    }
  }, [desktop, workspacePath]);

  const handleNotification = useCallback(
    (method: string, params: Record<string, unknown>) => {
      const threadId = typeof params.threadId === "string" ? params.threadId : null;
      if (method === "turn/started" && threadId && params.turn) {
        const turn = params.turn as CodexTurn;
        setRunningTurns((current) => ({ ...current, [threadId]: turn.id }));
        setActiveThread((current) =>
          current?.id === threadId ? upsertTurn(current, turn) : current,
        );
        return;
      }

      if (
        (method === "item/started" || method === "item/completed") &&
        threadId &&
        typeof params.turnId === "string" &&
        params.item
      ) {
        const item = params.item as CodexItem;
        setActiveThread((current) =>
          current?.id === threadId
            ? upsertItem(current, params.turnId as string, item)
            : current,
        );
        return;
      }

      if (
        (method === "item/agentMessage/delta" ||
          method === "item/commandExecution/outputDelta") &&
        threadId &&
        typeof params.turnId === "string" &&
        typeof params.itemId === "string" &&
        typeof params.delta === "string"
      ) {
        const field =
          method === "item/agentMessage/delta" ? "text" : "aggregatedOutput";
        setActiveThread((current) =>
          current?.id === threadId
            ? appendItemDelta(
                current,
                params.turnId as string,
                params.itemId as string,
                field,
                params.delta as string,
              )
            : current,
        );
        return;
      }

      if (method === "turn/completed" && threadId && params.turn) {
        const turn = params.turn as CodexTurn;
        setRunningTurns((current) => {
          if (current[threadId] !== turn.id) return current;
          const next = { ...current };
          delete next[threadId];
          return next;
        });
        setActiveThread((current) =>
          current?.id === threadId ? upsertTurn(current, turn) : current,
        );
        void loadThreads();
        return;
      }

      if (method === "thread/name/updated" || method === "thread/archived") {
        void loadThreads();
        return;
      }

      if (
        method === "serverRequest/resolved" &&
        (typeof params.requestId === "string" || typeof params.requestId === "number")
      ) {
        setPendingRequests((current) =>
          current.filter((request) => request.id !== params.requestId),
        );
        return;
      }

      if (method === "error") {
        const protocolError = params.error as { message?: string } | undefined;
        setError(protocolError?.message ?? "Codex reported an error.");
      }
    },
    [loadThreads],
  );

  useEffect(() => {
    if (!desktop) return undefined;
    const unsubscribe = codexClient.subscribe((event: CodexClientEvent) => {
      if (event.type === "connection") {
        setConnection(event.status);
        setConnectionDetail(event.detail ?? null);
        if (event.status === "disconnected" || event.status === "error") {
          setRunningTurns({});
        }
      } else if (event.type === "notification") {
        handleNotification(event.method, event.params);
      } else if (event.type === "serverRequest") {
        setPendingRequests((current) =>
          current.some((request) => request.id === event.request.id)
            ? current
            : [...current, event.request],
        );
      } else if (event.type === "diagnostic") {
        setError(event.message);
      }
    });
    return unsubscribe;
  }, [desktop, handleNotification]);

  useEffect(() => {
    if (!desktop || !workspacePath) return;
    let cancelled = false;
    setError(null);
    setAccount(null);
    setThreads([]);
    setActiveThread(null);
    setRunningTurns({});
    setLoadingThreads(true);

    void (async () => {
      try {
        await codexClient.connect();
        const [nextAccount, nextThreads] = await Promise.all([
          codexClient.account(),
          codexClient.listThreads(workspacePath),
        ]);
        if (!cancelled) {
          setAccount(nextAccount);
          setThreads(nextThreads);
        }
      } catch (connectError) {
        if (!cancelled) setError(errorMessage(connectError));
      } finally {
        if (!cancelled) setLoadingThreads(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [desktop, workspacePath]);

  const items = useMemo(
    () => activeThread?.turns.flatMap((turn) => turn.items) ?? [],
    [activeThread],
  );

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "auto" });
  }, [items.length, items.at(-1)?.text, items.at(-1)?.aggregatedOutput]);

  const openThread = useCallback(
    async (thread: CodexThread) => {
      if (!workspacePath) return;
      setOpeningThreadId(thread.id);
      setError(null);
      try {
        const loaded = await codexClient.readThread(thread.id);
        setActiveThread(loaded);
        const loadedTurnId = codexClient.hasLoadedThread(loaded.id)
          ? [...loaded.turns].reverse().find((turn) => turn.status === "inProgress")?.id ?? null
          : null;
        setRunningTurns((current) => {
          const next = { ...current };
          if (loadedTurnId) next[loaded.id] = loadedTurnId;
          else delete next[loaded.id];
          return next;
        });
      } catch (openError) {
        setError(errorMessage(openError));
      } finally {
        setOpeningThreadId(null);
      }
    },
    [workspacePath],
  );

  const newThread = useCallback(async () => {
    if (!workspacePath) return null;
    setOpeningThreadId("new");
    setError(null);
    try {
      const thread = await codexClient.startThread(workspacePath);
      setActiveThread(thread);
      setRunningTurns((current) => {
        const next = { ...current };
        delete next[thread.id];
        return next;
      });
      setThreads((current) => [thread, ...current.filter((item) => item.id !== thread.id)]);
      return thread;
    } catch (startError) {
      setError(errorMessage(startError));
      return null;
    } finally {
      setOpeningThreadId(null);
    }
  }, [workspacePath]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || !workspacePath || sending || threadBusy) return;
    setSending(true);
    setError(null);
    try {
      const selected = activeThread ?? (await newThread());
      if (!selected) return;
      const thread = activeThread
        ? await codexClient.resumeThread(selected.id, workspacePath)
        : selected;
      setActiveThread(thread);
      setDraft("");
      const turn = await codexClient.startTurn(thread.id, workspacePath, text);
      setRunningTurns((current) => ({ ...current, [thread.id]: turn.id }));
      setActiveThread((current) =>
        current?.id === thread.id ? upsertTurn(current, turn) : upsertTurn(thread, turn),
      );
    } catch (sendError) {
      setError(errorMessage(sendError));
    } finally {
      setSending(false);
    }
  }, [activeThread, draft, newThread, sending, threadBusy, workspacePath]);

  const interrupt = useCallback(async () => {
    if (!activeThread || !runningTurnId) return;
    try {
      await codexClient.interruptTurn(activeThread.id, runningTurnId);
    } catch (interruptError) {
      setError(errorMessage(interruptError));
    }
  }, [activeThread, runningTurnId]);

  const resolveRequest = useCallback(
    async (request: CodexServerRequest, result: unknown) => {
      try {
        await codexClient.respondToServerRequest(request.id, result);
        setPendingRequests((current) =>
          current.filter((candidate) => candidate.id !== request.id),
        );
      } catch (responseError) {
        setError(errorMessage(responseError));
      }
    },
    [],
  );

  if (!desktop) return <DesktopOnlyChat />;

  const subscriptionUnavailable = account !== null && account.account?.type !== "chatgpt";

  return (
    <main className="fade-rise mx-auto flex h-full w-full max-w-[1380px] gap-4 px-5 pb-5 pt-20 sm:px-8 sm:pt-24">
      <aside className="flex w-[250px] shrink-0 flex-col overflow-hidden rounded-sm border border-line-strong bg-bg-elev/75 shadow-[var(--shadow-card)]">
        <div className="border-b border-line p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.26em] text-amber">
                Local Codex
              </p>
              <p className="mt-1 text-[12px] text-ink-soft">
                {account?.account?.type === "chatgpt"
                  ? account.account.email ?? "ChatGPT subscription"
                  : connection === "connected"
                    ? "Connected"
                    : "Starting…"}
              </p>
            </div>
            <StatusDot status={connection} />
          </div>
          <button
            type="button"
            onClick={() => void newThread()}
            disabled={openingThreadId !== null || subscriptionUnavailable || account === null}
            className="mt-4 w-full rounded-sm bg-amber px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-bg-deep transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {openingThreadId === "new" ? "Starting…" : "+ New chat"}
          </button>
        </div>

        <div className="flex items-center justify-between px-4 pb-2 pt-4 font-mono text-[9px] uppercase tracking-[0.2em] text-ink-dim">
          <span>Project chats</span>
          <button
            type="button"
            onClick={() => void loadThreads()}
            disabled={loadingThreads}
            className="transition-colors hover:text-amber disabled:opacity-40"
          >
            {loadingThreads ? "…" : "Refresh"}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {threads.length === 0 ? (
            <p className="px-2 py-5 text-[12px] leading-relaxed text-ink-dim">
              {loadingThreads ? "Loading Codex history…" : "No chats in this workspace yet."}
            </p>
          ) : (
            threads.map((thread) => (
              <ThreadButton
                key={thread.id}
                thread={thread}
                active={thread.id === activeThread?.id}
                loading={thread.id === openingThreadId}
                onClick={() => void openThread(thread)}
              />
            ))
          )}
        </div>
      </aside>

      <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-sm border border-line-strong bg-bg-elev/55 shadow-[var(--shadow-card)]">
        <ChatHeader
          thread={activeThread}
          connectionDetail={connectionDetail}
          account={account}
        />

        {subscriptionUnavailable ? (
          <AuthRequired account={account} />
        ) : (
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8">
            {activeThread ? (
              items.length > 0 ? (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                  {items.map((item) => (
                    <ChatItem key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <EmptyConversation />
              )
            ) : (
              <ChatWelcome />
            )}
          </div>
        )}

        {pendingRequests.length > 0 && (
          <div className="max-h-[45%] overflow-y-auto border-t border-amber/30 bg-bg-deep/80 px-5 py-3 sm:px-8">
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
              {pendingRequests.map((request) => (
                <RequestCard
                  key={String(request.id)}
                  request={request}
                  threadName={threadNameForRequest(request, threads, activeThread)}
                  onResolve={(result) => void resolveRequest(request, result)}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="border-t border-rust/30 bg-rust/10 px-5 py-2.5 sm:px-8">
            <div className="mx-auto flex max-w-3xl items-start justify-between gap-4">
              <p className="font-mono text-[10.5px] leading-relaxed text-rust">{error}</p>
              <button
                type="button"
                onClick={() => setError(null)}
                className="font-mono text-[10px] uppercase tracking-wider text-rust opacity-70 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {!subscriptionUnavailable && (
          <Composer
            draft={draft}
            disabled={connection !== "connected" || sending || account === null}
            busy={threadBusy}
            interruptible={Boolean(runningTurnId)}
            onChange={setDraft}
            onSend={() => void sendMessage()}
            onInterrupt={() => void interrupt()}
          />
        )}
      </section>
    </main>
  );
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  const color =
    status === "connected"
      ? "var(--color-green)"
      : status === "error" || status === "disconnected"
        ? "var(--color-rust)"
        : "var(--color-amber)";
  return (
    <span
      aria-label={`Codex ${status}`}
      title={`Codex ${status}`}
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ background: color, boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 18%, transparent)` }}
    />
  );
}

function ThreadButton({
  thread,
  active,
  loading,
  onClick,
}: {
  thread: CodexThread;
  active: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  const title = thread.name?.trim() || thread.preview?.trim() || "Untitled Codex chat";
  const timestamp = thread.recencyAt ?? thread.updatedAt ?? thread.createdAt;
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-1 w-full rounded-sm px-3 py-3 text-left transition-colors"
      style={{
        color: active ? "var(--color-ink)" : "var(--color-ink-soft)",
        background: active
          ? "color-mix(in srgb, var(--color-amber) 12%, transparent)"
          : "transparent",
      }}
    >
      <span className="line-clamp-2 text-[12.5px] leading-snug">{loading ? "Opening…" : title}</span>
      <span className="mt-1.5 block font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-dim">
        {formatTimestamp(timestamp)}
        {thread.status?.type === "active" ? " · active" : ""}
      </span>
    </button>
  );
}

function ChatHeader({
  thread,
  connectionDetail,
  account,
}: {
  thread: CodexThread | null;
  connectionDetail: string | null;
  account: AccountStatus | null;
}) {
  const title = thread?.name?.trim() || thread?.preview?.trim() || "Codex workspace chat";
  const plan = account?.account?.type === "chatgpt" ? account.account.planType : null;
  return (
    <header className="flex min-h-[65px] items-center justify-between gap-5 border-b border-line px-5 py-3 sm:px-8">
      <div className="min-w-0">
        <h1 className="truncate font-display text-[20px] text-ink">{title}</h1>
        <p className="mt-0.5 truncate font-mono text-[8.5px] uppercase tracking-[0.15em] text-ink-dim">
          {thread ? thread.cwd : "Selected learning workspace"}
        </p>
      </div>
      <div className="shrink-0 text-right font-mono text-[8.5px] uppercase tracking-[0.14em] text-ink-dim">
        <div>{plan ? `ChatGPT ${plan}` : "Local app server"}</div>
        {connectionDetail && <div className="mt-1 max-w-48 truncate normal-case">{connectionDetail}</div>}
      </div>
    </header>
  );
}

function ChatItem({ item }: { item: CodexItem }) {
  if (item.type === "userMessage") {
    const text = item.content?.filter((part) => part.type === "text").map((part) => part.text).join("\n") ?? "";
    return (
      <div className="ml-auto max-w-[84%] rounded-sm border border-amber/20 bg-amber/10 px-4 py-3 text-[14px] leading-relaxed text-ink">
        <div className="whitespace-pre-wrap break-words">{text}</div>
      </div>
    );
  }

  if (item.type === "agentMessage") {
    return (
      <article className="max-w-[92%] border-l-2 border-amber/45 pl-4 text-[14px] leading-[1.72] text-ink-soft">
        <div className="whitespace-pre-wrap break-words">{item.text || "…"}</div>
      </article>
    );
  }

  if (item.type === "plan") {
    return <Activity label="Plan" body={item.text ?? ""} />;
  }

  if (item.type === "reasoning") {
    return <Activity label="Reasoning" body={(item.summary ?? []).join("\n")} />;
  }

  if (item.type === "commandExecution") {
    return (
      <Activity
        label={`Command · ${item.status ?? "running"}`}
        body={[item.command, item.aggregatedOutput].filter(Boolean).join("\n\n")}
        mono
      />
    );
  }

  if (item.type === "fileChange") {
    const changes = item.changes ?? [];
    return (
      <Activity
        label={`Files · ${item.status ?? "changed"}`}
        body={changes
          .map((change) => `${change.kind}: ${change.path}\n${change.diff}`)
          .join("\n\n")}
        mono
      />
    );
  }

  if (item.type === "mcpToolCall" || item.type === "dynamicToolCall") {
    return (
      <Activity
        label={`Tool · ${item.server ? `${item.server}/` : ""}${item.tool ?? "call"}`}
        body={stringifyCompact(item.result ?? item.error ?? item.arguments)}
        mono
      />
    );
  }

  if (item.type === "contextCompaction") {
    return (
      <div className="flex items-center gap-3 py-2 font-mono text-[8.5px] uppercase tracking-[0.2em] text-ink-dim">
        <span className="h-px flex-1 bg-line" />Context compacted<span className="h-px flex-1 bg-line" />
      </div>
    );
  }

  return null;
}

function Activity({ label, body, mono = false }: { label: string; body: string; mono?: boolean }) {
  return (
    <details className="rounded-sm border border-line bg-bg-deep/35 px-3 py-2 text-ink-dim">
      <summary className="cursor-pointer font-mono text-[9px] uppercase tracking-[0.18em] text-ink-dim">
        {label}
      </summary>
      {body && (
        <pre
          className={`mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed text-ink-soft ${mono ? "font-mono" : "font-body"}`}
        >
          {body}
        </pre>
      )}
    </details>
  );
}

function Composer({
  draft,
  disabled,
  busy,
  interruptible,
  onChange,
  onSend,
  onInterrupt,
}: {
  draft: string;
  disabled: boolean;
  busy: boolean;
  interruptible: boolean;
  onChange: (text: string) => void;
  onSend: () => void;
  onInterrupt: () => void;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSend();
    }
  }

  return (
    <div className="border-t border-line bg-bg-elev/90 px-5 py-4 sm:px-8">
      <div className="mx-auto flex max-w-3xl items-end gap-3 rounded-sm border border-line-strong bg-bg-deep/55 p-2 focus-within:border-amber/60">
        <textarea
          rows={2}
          value={draft}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || busy}
          placeholder={
            interruptible
              ? "Codex is working…"
              : busy
                ? "This task is active in another Codex client…"
                : "Ask Codex to study, inspect, or update this workspace…"
          }
          className="max-h-40 min-h-[48px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-ink-dim disabled:cursor-not-allowed"
        />
        {interruptible ? (
          <button
            type="button"
            onClick={onInterrupt}
            className="mb-1 rounded-sm border border-rust/50 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-rust hover:bg-rust/10"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={disabled || busy || !draft.trim()}
            className="mb-1 rounded-sm bg-amber px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-bg-deep hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-35"
          >
            Send
          </button>
        )}
      </div>
      <p className="mx-auto mt-2 max-w-3xl font-mono text-[8px] uppercase tracking-[0.13em] text-ink-dim">
        Enter to send · Shift+Enter for a new line · writes require the Codex sandbox and approvals
      </p>
    </div>
  );
}

function RequestCard({
  request,
  threadName,
  onResolve,
}: {
  request: CodexServerRequest;
  threadName: string;
  onResolve: (result: unknown) => void;
}) {
  if (request.method === "item/tool/requestUserInput") {
    return <UserInputRequest request={request} threadName={threadName} onResolve={onResolve} />;
  }

  if (request.method === "item/permissions/requestApproval") {
    return <PermissionRequest request={request} threadName={threadName} onResolve={onResolve} />;
  }

  const command = typeof request.params.command === "string" ? request.params.command : null;
  const cwd = typeof request.params.cwd === "string" ? request.params.cwd : null;
  const reason = typeof request.params.reason === "string" ? request.params.reason : null;
  const grantRoot = typeof request.params.grantRoot === "string" ? request.params.grantRoot : null;
  const isCommand = request.method === "item/commandExecution/requestApproval";
  const choices = approvalChoices(request);

  return (
    <section className="rounded-sm border border-amber/40 bg-bg-elev px-4 py-3 shadow-lg">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber">
        Codex needs approval · {isCommand ? "command" : "file access"}
      </p>
      <p className="mt-1 truncate font-mono text-[8px] uppercase tracking-[0.14em] text-ink-dim">
        Task · {threadName}
      </p>
      {reason && <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{reason}</p>}
      {(command || grantRoot) && (
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-bg-deep p-2.5 font-mono text-[10.5px] leading-relaxed text-ink">
          {command ?? `Write access: ${grantRoot}`}
        </pre>
      )}
      {cwd && <p className="mt-1.5 truncate font-mono text-[8.5px] text-ink-dim">{cwd}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {choices.map((choice) => (
          <button
            key={stringifyCompact(choice.decision)}
            type="button"
            onClick={() => onResolve({ decision: choice.decision })}
            className={approvalChoiceClass(choice.kind)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </section>
  );
}

type ApprovalChoice = {
  decision: unknown;
  label: string;
  kind: "decline" | "persistent" | "accept";
};

function approvalChoices(request: CodexServerRequest): ApprovalChoice[] {
  const decisions =
    request.method === "item/commandExecution/requestApproval" &&
    Array.isArray(request.params.availableDecisions)
      ? request.params.availableDecisions
      : ["decline", "acceptForSession", "accept"];

  return decisions.flatMap((decision): ApprovalChoice[] => {
    if (decision === "decline" || decision === "cancel") {
      return [{ decision, label: decision === "cancel" ? "Cancel" : "Decline", kind: "decline" }];
    }
    if (decision === "acceptForSession") {
      return [{ decision, label: "Allow session", kind: "persistent" }];
    }
    if (decision === "accept") {
      return [{ decision, label: "Allow once", kind: "accept" }];
    }
    if (isRecord(decision) && "acceptWithExecpolicyAmendment" in decision) {
      return [{ decision, label: "Allow similar commands", kind: "persistent" }];
    }
    if (isRecord(decision) && "applyNetworkPolicyAmendment" in decision) {
      return [{ decision, label: "Apply network rule", kind: "persistent" }];
    }
    return [];
  });
}

function approvalChoiceClass(kind: ApprovalChoice["kind"]): string {
  const base =
    "rounded-sm px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em]";
  if (kind === "decline") {
    return `${base} border border-line-strong text-ink-soft hover:border-rust/60 hover:text-rust`;
  }
  if (kind === "persistent") {
    return `${base} border border-amber/50 text-amber hover:bg-amber/10`;
  }
  return `${base} bg-amber text-bg-deep hover:opacity-85`;
}

interface UserQuestion {
  id: string;
  header: string;
  question: string;
  isOther: boolean;
  isSecret: boolean;
  options: Array<{ label: string; description: string }> | null;
}

function UserInputRequest({
  request,
  threadName,
  onResolve,
}: {
  request: CodexServerRequest;
  threadName: string;
  onResolve: (result: unknown) => void;
}) {
  const questions = Array.isArray(request.params.questions)
    ? (request.params.questions as UserQuestion[])
    : [];
  const [answers, setAnswers] = useState<Record<string, string>>({});

  function submit(event: FormEvent) {
    event.preventDefault();
    onResolve({
      answers: Object.fromEntries(
        questions.map((question) => [
          question.id,
          { answers: [answers[question.id] ?? ""] },
        ]),
      ),
    });
  }

  return (
    <form onSubmit={submit} className="rounded-sm border border-amber/40 bg-bg-elev px-4 py-3 shadow-lg">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber">
        Codex is asking
      </p>
      <p className="mt-1 truncate font-mono text-[8px] uppercase tracking-[0.14em] text-ink-dim">
        Task · {threadName}
      </p>
      <div className="mt-3 space-y-4">
        {questions.map((question) => (
          <fieldset key={question.id}>
            <legend className="text-[12.5px] leading-relaxed text-ink">{question.question}</legend>
            {question.options ? (
              <div className="mt-2 flex flex-col gap-1.5">
                {question.options.map((option) => (
                  <label key={option.label} className="flex cursor-pointer gap-2 rounded-sm border border-line px-3 py-2 hover:border-line-strong">
                    <input
                      type="radio"
                      name={question.id}
                      value={option.label}
                      checked={answers[question.id] === option.label}
                      onChange={() =>
                        setAnswers((current) => ({ ...current, [question.id]: option.label }))
                      }
                    />
                    <span>
                      <span className="block text-[12px] text-ink">{option.label}</span>
                      <span className="block text-[10.5px] text-ink-dim">{option.description}</span>
                    </span>
                  </label>
                ))}
                {question.isOther && (
                  <input
                    type={question.isSecret ? "password" : "text"}
                    placeholder="Another answer…"
                    value={
                      question.options.some((option) => option.label === answers[question.id])
                        ? ""
                        : answers[question.id] ?? ""
                    }
                    onChange={(event) =>
                      setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                    }
                    className="rounded-sm border border-line bg-bg-deep px-3 py-2 text-[12px] text-ink outline-none focus:border-amber/60"
                  />
                )}
              </div>
            ) : (
              <input
                type={question.isSecret ? "password" : "text"}
                value={answers[question.id] ?? ""}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [question.id]: event.target.value }))
                }
                className="mt-2 w-full rounded-sm border border-line bg-bg-deep px-3 py-2 text-[12px] text-ink outline-none focus:border-amber/60"
              />
            )}
          </fieldset>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onResolve({ answers: {} })}
          className="rounded-sm border border-line-strong px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink-soft"
        >
          Skip
        </button>
        <button
          type="submit"
          className="rounded-sm bg-amber px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-bg-deep"
        >
          Answer
        </button>
      </div>
    </form>
  );
}

function ChatWelcome() {
  return (
    <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center pb-16 text-center">
      <blockquote className="font-display text-3xl leading-snug text-ink">
        The mind is not a vessel to be filled, but a fire to be kindled.
      </blockquote>
    </div>
  );
}

function EmptyConversation() {
  return (
    <div className="mx-auto flex min-h-[48vh] max-w-lg flex-col items-center justify-center text-center">
      <h2 className="font-display text-2xl text-ink">What should Codex do here?</h2>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
        You can begin a learning session, inspect the vault, or ask for a deliberate change. Codex
        will use its normal local instructions, sandbox, and approval flow.
      </p>
    </div>
  );
}

function AuthRequired({ account }: { account: AccountStatus }) {
  const usesApiKey = account.account?.type === "apiKey";
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8">
      <section className="max-w-lg rounded-sm border border-rust/35 bg-rust/10 p-6">
        <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-rust">
          {usesApiKey ? "Subscription required" : "Sign-in required"}
        </p>
        <h2 className="mt-3 font-display text-2xl text-ink">
          {usesApiKey
            ? "Codex is currently using API-key authentication."
            : "Codex is installed but not signed in with ChatGPT."}
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          {usesApiKey ? (
            <>
              This app intentionally uses your existing subscription instead of API billing. Run{" "}
              <code className="font-mono text-ink">codex logout</code>, then{" "}
              <code className="font-mono text-ink">codex login</code> and choose your ChatGPT account.
            </>
          ) : (
            <>
              Run <code className="font-mono text-ink">codex login</code> in a terminal and choose your
              ChatGPT account. Then restart this app. No API key is needed.
            </>
          )}
        </p>
      </section>
    </div>
  );
}

function DesktopOnlyChat() {
  return (
    <main className="fade-rise mx-auto flex h-full max-w-2xl items-center justify-center px-8 pt-20">
      <section className="rounded-sm border border-line-strong bg-bg-elev p-8 text-center shadow-[var(--shadow-card)]">
        <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-amber">Desktop feature</p>
        <h1 className="mt-3 font-display text-3xl text-ink">Codex chat runs in the native app.</h1>
        <p className="mt-4 text-[13.5px] leading-relaxed text-ink-soft">
          The browser/server tracker remains available for every learning view. Start the Tauri app
          with <code className="font-mono text-ink">pnpm desktop:dev</code> to use your installed
          Codex subscription and local chat history.
        </p>
      </section>
    </main>
  );
}

function formatTimestamp(seconds: number): string {
  if (!seconds) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: new Date(seconds * 1000).getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(new Date(seconds * 1000));
}

function stringifyCompact(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function threadNameForRequest(
  request: CodexServerRequest,
  threads: CodexThread[],
  activeThread: CodexThread | null,
): string {
  const threadId = typeof request.params.threadId === "string" ? request.params.threadId : null;
  if (!threadId) return "Current task";
  const thread = activeThread?.id === threadId
    ? activeThread
    : threads.find((candidate) => candidate.id === threadId);
  return thread?.name?.trim() || thread?.preview?.trim() || threadId.slice(0, 12);
}

function PermissionRequest({
  request,
  threadName,
  onResolve,
}: {
  request: CodexServerRequest;
  threadName: string;
  onResolve: (result: unknown) => void;
}) {
  const permissions = isRecord(request.params.permissions)
    ? request.params.permissions
    : {};
  const grantedPermissions = Object.fromEntries(
    Object.entries(permissions).filter(([, value]) => value !== null),
  );
  const reason = typeof request.params.reason === "string" ? request.params.reason : null;
  const cwd = typeof request.params.cwd === "string" ? request.params.cwd : null;

  return (
    <section className="rounded-sm border border-amber/40 bg-bg-elev px-4 py-3 shadow-lg">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber">
        Codex needs approval · permissions
      </p>
      <p className="mt-1 truncate font-mono text-[8px] uppercase tracking-[0.14em] text-ink-dim">
        Task · {threadName}
      </p>
      {reason && <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{reason}</p>}
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-sm bg-bg-deep p-2.5 font-mono text-[10.5px] leading-relaxed text-ink">
        {stringifyCompact(permissions)}
      </pre>
      {cwd && <p className="mt-1.5 truncate font-mono text-[8.5px] text-ink-dim">{cwd}</p>}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => onResolve({ permissions: {}, scope: "turn" })}
          className="rounded-sm border border-line-strong px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink-soft hover:border-rust/60 hover:text-rust"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => onResolve({ permissions: grantedPermissions, scope: "session" })}
          className="rounded-sm border border-amber/50 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-amber hover:bg-amber/10"
        >
          Allow session
        </button>
        <button
          type="button"
          onClick={() => onResolve({ permissions: grantedPermissions, scope: "turn" })}
          className="rounded-sm bg-amber px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-bg-deep hover:opacity-85"
        >
          Allow turn
        </button>
      </div>
    </section>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
