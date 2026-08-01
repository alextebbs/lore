import { useEffect, useRef, useState } from "react";
import { Pin, Sparkles, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  sendMessage,
  type AgentEvent,
  type ContentBlock,
  type Tray,
} from "./api";

// The in-app agent harness — UI-only orchestration over public tools
// (SPEC tenet 2 exception). The tray it displays is a real capability,
// identical on API and MCP.

type ChatItem =
  | { kind: "user"; text: string }
  | { kind: "text"; text: string }
  | { kind: "tool"; name: string; result?: string; isError?: boolean }
  | { kind: "error"; text: string };

function blocksToItems(role: string, blocks: ContentBlock[]): ChatItem[] {
  const items: ChatItem[] = [];
  for (const b of blocks) {
    if (b.type === "text" && b.text) {
      items.push(role === "user" ? { kind: "user", text: b.text } : { kind: "text", text: b.text });
    } else if (b.type === "tool_use") {
      items.push({ kind: "tool", name: b.name ?? "tool" });
    }
  }
  return items;
}

function TrayPanel({
  tray,
  conversationId,
  worldId,
  onChanged,
}: {
  tray: Tray;
  conversationId: string | null;
  worldId: string;
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const qc = useQueryClient();
  const pct = Math.min(100, Math.round((tray.total_tokens / tray.budget) * 100));
  const sourceStyle: Record<string, string> = {
    pinned: "text-sky-300 border-sky-800",
    current: "text-emerald-300 border-emerald-800",
    neighbor: "text-neutral-400 border-neutral-700",
    auto: "text-amber-300 border-amber-800",
  };

  return (
    <div className="space-y-2 border-b border-neutral-800 p-3">
      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span className="tracking-wide">Context</span>
        <span>
          ~{tray.total_tokens} / {tray.budget} tokens
        </span>
      </div>
      <div className="h-1 rounded bg-neutral-800">
        <div
          className={`h-1 rounded ${pct > 90 ? "bg-amber-500" : "bg-neutral-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {(tray.items ?? []).map((item) => (
          <li key={item.entry_id} className="text-xs">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  setExpanded(expanded === item.entry_id ? null : item.entry_id)
                }
                className="flex-1 truncate text-left text-neutral-300 hover:text-white"
                title="Show exact serialized text"
              >
                {item.title}
              </button>
              <span
                className={`rounded border px-1.5 ${sourceStyle[item.source]}`}
              >
                {item.source}
              </span>
              <span className="text-neutral-600">
                {item.level}·{item.tokens}t
              </span>
              {item.source === "auto" && (
                <>
                  <button
                    title="Promote to pin"
                    onClick={async () => {
                      await api.createPin(worldId, item.entry_id, false);
                      onChanged();
                      qc.invalidateQueries({ queryKey: ["tray"] });
                    }}
                    className="text-sky-500 hover:text-sky-300"
                  >
                    <Pin size={12} />
                  </button>
                  {conversationId && (
                    <button
                      title="Evict from this conversation"
                      onClick={async () => {
                        await api.evictAutoItem(conversationId, item.entry_id);
                        onChanged();
                      }}
                      className="text-neutral-600 hover:text-red-400"
                    >
                      <X size={12} />
                    </button>
                  )}
                </>
              )}
              {item.source === "pinned" && (
                <button
                  title="Unpin"
                  onClick={async () => {
                    await api.deletePin(worldId, item.entry_id);
                    onChanged();
                    qc.invalidateQueries({ queryKey: ["tray"] });
                  }}
                  className="text-neutral-600 hover:text-red-400"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {expanded === item.entry_id && (
              <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-neutral-900 p-2 text-[10px] text-neutral-400">
                {item.text}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChatPanel({
  worldId,
  currentEntryId,
}: {
  worldId: string;
  currentEntryId?: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [items, setItems] = useState<ChatItem[]>([]);
  const [tray, setTray] = useState<Tray | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const initialTray = useQuery({
    queryKey: ["tray", worldId, currentEntryId],
    queryFn: () => api.getTray(worldId, currentEntryId),
    enabled: open && !tray,
  });
  const shownTray = tray ?? initialTray.data ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  const send = async () => {
    const content = input.trim();
    if (!content || busy) return;
    setInput("");
    setBusy(true);
    setItems((prev) => [...prev, { kind: "user", text: content }]);
    try {
      let cid = conversationId;
      if (!cid) {
        cid = (await api.createConversation(worldId)).id;
        setConversationId(cid);
      }
      for await (const ev of sendMessage(cid, content, currentEntryId)) {
        handleEvent(ev);
      }
      // world content may have changed — refresh everything
      qc.invalidateQueries();
    } catch (e) {
      setItems((prev) => [
        ...prev,
        { kind: "error", text: e instanceof Error ? e.message : String(e) },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const handleEvent = (ev: AgentEvent) => {
    if (ev.type === "context" && ev.tray) setTray(ev.tray);
    else if (ev.type === "text" && ev.text)
      setItems((prev) => [...prev, { kind: "text", text: ev.text! }]);
    else if (ev.type === "tool_call")
      setItems((prev) => [...prev, { kind: "tool", name: ev.name ?? "tool" }]);
    else if (ev.type === "tool_result")
      setItems((prev) => {
        const next = [...prev];
        for (let i = next.length - 1; i >= 0; i--) {
          const it = next[i];
          if (it.kind === "tool" && it.result === undefined) {
            next[i] = { ...it, result: ev.result, isError: ev.is_error };
            break;
          }
        }
        return next;
      });
    else if (ev.type === "error" && ev.text)
      setItems((prev) => [...prev, { kind: "error", text: ev.text! }]);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn btn-solid panel"
      >
        <Sparkles size={14} /> Assistant
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 top-0 z-10 flex w-96 flex-col border-l border-neutral-800 bg-neutral-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-medium"><Sparkles size={14} /> Assistant</span>
        <div className="flex gap-2">
          <button
            title="New conversation"
            onClick={() => {
              setConversationId(null);
              setItems([]);
              setTray(null);
            }}
            className="text-xs text-neutral-500 hover:text-neutral-300"
          >
            new
          </button>
          <button
            onClick={() => setOpen(false)}
            className="text-neutral-500 hover:text-neutral-300"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {shownTray && (
        <TrayPanel
          tray={shownTray}
          conversationId={conversationId}
          worldId={worldId}
          onChanged={() => setTray(null)}
        />
      )}

      <div className="flex-1 space-y-2 overflow-y-auto p-3 text-sm">
        {items.length === 0 && (
          <p className="text-neutral-600">
            Ask for new content, expansions, or connections. Everything the
            assistant writes lands as <span className="text-neutral-400">draft</span>{" "}
            until you promote it.
          </p>
        )}
        {items.map((item, i) =>
          item.kind === "user" ? (
            <div key={i} className="ml-6 rounded bg-neutral-800 px-3 py-2">
              {item.text}
            </div>
          ) : item.kind === "text" ? (
            <div key={i} className="whitespace-pre-wrap px-1 leading-relaxed">
              {item.text}
            </div>
          ) : item.kind === "tool" ? (
            <details key={i} className="rounded border border-neutral-800 px-2 py-1 text-xs">
              <summary
                className={item.isError ? "text-red-400" : "text-neutral-500"}
              >
                ⚙ {item.name}
                {item.result === undefined && " …"}
              </summary>
              {item.result && (
                <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap text-[10px] text-neutral-500">
                  {item.result}
                </pre>
              )}
            </details>
          ) : (
            <div key={i} className="rounded border border-red-900 bg-red-950/40 px-3 py-2 text-red-300">
              {item.text}
            </div>
          ),
        )}
        {busy && <p className="animate-pulse text-neutral-600">thinking…</p>}
        <div ref={bottomRef} />
      </div>

      <form
        className="border-t border-neutral-800 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={busy ? "working…" : "Ask the assistant…"}
          disabled={busy}
          className="input w-full"
        />
      </form>
    </div>
  );
}

export { blocksToItems };
