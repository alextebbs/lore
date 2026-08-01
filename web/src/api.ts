// Typed client for the content API. Body text is Markdown with {~draft}
// markers; the server owns conversion to/from the stored doc format.
import type { DocNode } from "./doc";

export type FieldDef = { name: string; kind: string; label?: string };
export type FieldValue = { value: unknown; status: "draft" | "canon" };
export type WorldSettings = {
  vibe?: string;
  style_prompt?: string;
  humans_author_as?: "draft" | "canon";
  ai_can_edit_canon?: boolean;
};
export type World = {
  id: string;
  name: string;
  settings: WorldSettings;
  created_at: string;
};
export type EntryType = {
  id: string;
  name: string;
  parent_id?: string;
  fields: FieldDef[];
  builtin: boolean;
};
export type EntrySummary = {
  id: string;
  title: string;
  type_id: string;
  type_name: string;
  status: string;
};
export type RelationConfig = {
  targets?: string[];
  many?: boolean;
  template?: string;
  inverse_label?: string;
  annotations?: boolean;
};
export type EntryRef = {
  id: string;
  title: string;
  type_name: string;
  status: string;
};
export type EdgeType = {
  id: string;
  field: string;
  to: EntryRef;
  annotation?: string;
  status: string;
};
export type RelationSection = {
  field: string;
  label: string;
  reverse?: boolean; // adds create the edge target→here
  config?: RelationConfig;
  edges: EdgeType[] | null;
};
export type Graph = {
  nodes: null | {
    id: string;
    title: string;
    type_name: string;
    status: string;
    depth: number;
  }[];
  edges: null | {
    id: string;
    from: string;
    to: string;
    field: string;
    annotation?: string;
    status: string;
  }[];
};
export type Entry = {
  id: string;
  world_id: string;
  type_id: string;
  type_name: string;
  title: string;
  fields: Record<string, FieldValue>;
  body_md: string;
  body_doc: DocNode;
  status: string;
  updated_at: string;
  relations: RelationSection[] | null;
};
export type Revision = {
  id: string;
  author: "human" | "ai";
  status: string;
  created_at: string;
};
export type RevisionDetail = Revision & {
  title: string;
  fields: Record<string, FieldValue>;
  body_md: string;
};
export type CanonScope = { fields?: string[]; body?: boolean };

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `request failed: ${res.status}`);
  return data as T;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  listWorlds: () => req<World[]>("/api/worlds"),
  createWorld: (name: string) => req<World>("/api/worlds", json({ name })),
  getWorld: (id: string) =>
    req<{ world: World; types: EntryType[] }>(`/api/worlds/${id}`),
  listEntries: (worldId: string) =>
    req<EntrySummary[]>(`/api/worlds/${worldId}/entries`),
  createEntry: (worldId: string, typeId: string, title: string) =>
    req<Entry>(
      `/api/worlds/${worldId}/entries`,
      json({ type_id: typeId, title }),
    ),
  getEntry: (id: string) => req<Entry>(`/api/entries/${id}`),
  updateEntry: (
    id: string,
    patch: {
      title?: string;
      fields?: Record<string, unknown>;
      body_md?: string;
      body_doc?: DocNode;
    },
  ) =>
    req<{ entry: Entry; warnings: string[] | null }>(`/api/entries/${id}`, {
      ...json(patch),
      method: "PATCH",
    }),
  markCanon: (id: string, scope: CanonScope = {}) =>
    req<Entry>(`/api/entries/${id}/canon`, json(scope)),
  listRevisions: (id: string) => req<Revision[]>(`/api/entries/${id}/revisions`),
  getRevision: (id: string, rid: string) =>
    req<RevisionDetail>(`/api/entries/${id}/revisions/${rid}`),
  restoreRevision: (id: string, rid: string) =>
    req<Entry>(`/api/entries/${id}/revisions/${rid}/restore`, json({})),
  createEdge: (id: string, field: string, to: string, annotation: string) =>
    req<{ edge: EdgeType; warnings: string[] | null }>(
      `/api/entries/${id}/edges`,
      json({ field, to, annotation }),
    ),
  deleteEdge: (edgeId: string) =>
    req<{ deleted: boolean }>(`/api/edges/${edgeId}`, { method: "DELETE" }),
  getGraph: (id: string, depth: 1 | 2) =>
    req<Graph>(`/api/entries/${id}/graph?depth=${depth}`),
  updateWorldSettings: (id: string, settings: WorldSettings) =>
    req<World>(`/api/worlds/${id}`, { ...json(settings), method: "PATCH" }),
  deleteWorld: (id: string) =>
    req<{ deleted: boolean }>(`/api/worlds/${id}`, { method: "DELETE" }),
  deleteEntry: (id: string) =>
    req<{ deleted: boolean }>(`/api/entries/${id}`, { method: "DELETE" }),
  getTray: (worldId: string, current?: string) =>
    req<Tray>(
      `/api/worlds/${worldId}/tray${current ? `?current=${current}` : ""}`,
    ),
  createPin: (worldId: string, entryId: string, withNeighbors: boolean) =>
    req<{ pinned: boolean }>(
      `/api/worlds/${worldId}/tray/pins`,
      json({ entry_id: entryId, with_neighbors: withNeighbors }),
    ),
  deletePin: (worldId: string, entryId: string) =>
    req<{ unpinned: boolean }>(`/api/worlds/${worldId}/tray/pins/${entryId}`, {
      method: "DELETE",
    }),
  listConversations: (worldId: string) =>
    req<{ id: string; title: string; message_count: number }[]>(
      `/api/worlds/${worldId}/conversations`,
    ),
  createConversation: (worldId: string) =>
    req<{ id: string }>(`/api/worlds/${worldId}/conversations`, json({})),
  getConversation: (id: string) =>
    req<{ role: string; content: ContentBlock[] }[]>(`/api/conversations/${id}`),
  evictAutoItem: (conversationId: string, entryId: string) =>
    req<{ evicted: string[] }>(
      `/api/conversations/${conversationId}/evict`,
      json({ entry_id: entryId }),
    ),
};

export type TrayItem = {
  entry_id: string;
  title: string;
  source: "pinned" | "current" | "neighbor" | "auto";
  level: "full" | "digest" | "card";
  text: string;
  tokens: number;
  score?: number;
};
export type Tray = { items: TrayItem[] | null; total_tokens: number; budget: number };
export type ContentBlock = {
  type: string;
  text?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
  is_error?: boolean;
};
export type AgentEvent = {
  type: "context" | "text" | "tool_call" | "tool_result" | "error" | "done";
  text?: string;
  name?: string;
  input?: unknown;
  result?: string;
  is_error?: boolean;
  tray?: Tray;
};

// POST a chat message; yields agent events from the SSE stream.
export async function* sendMessage(
  conversationId: string,
  content: string,
  currentEntryId?: string,
): AsyncGenerator<AgentEvent> {
  const res = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, current_entry_id: currentEntryId ?? "" }),
  });
  if (!res.ok || !res.body) throw new Error(`chat failed: ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (line.startsWith("data: ")) {
        yield JSON.parse(line.slice(6)) as AgentEvent;
      }
    }
  }
}
