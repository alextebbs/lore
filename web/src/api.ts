// Typed client for the content API. Body text is Markdown with {~draft}
// markers; the server owns conversion to/from the stored doc format.
import type { DocNode } from "./doc";

export type FieldDef = { name: string; kind: string; label?: string };
export type FieldValue = { value: unknown; status: "draft" | "canon" };
export type World = { id: string; name: string; created_at: string };
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
};
