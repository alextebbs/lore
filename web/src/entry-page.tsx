import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Pin,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  api,
  type Entry,
  type FieldValue,
  type Revision as RevisionType,
} from "./api";
import { BodyEditor, InlineField } from "./editor";
import { usePageCommands } from "./palette";
import { ChatPanel } from "./chat";
import { EgoGraph } from "./graph";
import { diffWords } from "./diff";
import { emptyDoc, type DocNode } from "./doc";
import { Confirm, EntrySkeleton, IconTip, StatusBadge, asFieldDoc, strToDoc, titleCase } from "./ui";
import { WorldSidebar } from "./sidebar";
import { RelationsPanel } from "./relations";

function RevisionRow({
  entryId,
  rev,
  currentBody,
  onRestored,
}: {
  entryId: string;
  rev: RevisionType;
  currentBody: string;
  onRestored: (e: Entry) => void;
}) {
  const [open, setOpen] = useState(false);
  const detail = useQuery({
    queryKey: ["revision", rev.id],
    queryFn: () => api.getRevision(entryId, rev.id),
    enabled: open,
  });
  const restore = useMutation({
    mutationFn: () => api.restoreRevision(entryId, rev.id),
    onSuccess: onRestored,
  });

  return (
    <li className="rounded-lg border border-neutral-800">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
      >
        <span className="flex items-center gap-2">
          <span
            className={
              rev.author === "ai" ? "text-neutral-500" : "text-neutral-300"
            }
          >
            {rev.author}
          </span>
          <StatusBadge status={rev.status} />
        </span>
        <span className="text-xs text-neutral-500">
          {new Date(rev.created_at).toLocaleString()}
        </span>
      </button>
      {open && detail.data && (
        <div className="space-y-3 border-t border-neutral-800 p-3 text-sm">
          <div className="whitespace-pre-wrap rounded bg-neutral-900 p-2 leading-relaxed">
            {diffWords(currentBody, detail.data.body_md).map((p, i) =>
              p.type === "same" ? (
                <span key={i}>{p.text}</span>
              ) : p.type === "add" ? (
                <span key={i} className="rounded bg-emerald-950 text-emerald-300">
                  {p.text}
                </span>
              ) : (
                <span
                  key={i}
                  className="rounded bg-red-950 text-red-400 line-through"
                >
                  {p.text}
                </span>
              ),
            )}
            {detail.data.body_md === "" && currentBody === "" && (
              <span className="text-neutral-600">empty body</span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-neutral-500">
              diff vs current (green = in revision, red = only in current)
            </span>
            <button
              onClick={() => restore.mutate()}
              disabled={restore.isPending}
              className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-800"
            >
              Restore this revision
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

// Last world seen — lets the sidebar stay mounted while the next
// entry loads (module-scoped; survives keyed remounts).
let lastWorldId = "";

export function EntryPage({ entryId }: { entryId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const entry = useQuery({
    queryKey: ["entry", entryId],
    queryFn: () => api.getEntry(entryId),
  });
  const world = useQuery({
    queryKey: ["world", entry.data?.world_id],
    queryFn: () => api.getWorld(entry.data!.world_id),
    enabled: !!entry.data,
  });
  const revisions = useQuery({
    queryKey: ["revisions", entryId],
    queryFn: () => api.listRevisions(entryId),
  });
  const worldEntries = useQuery({
    queryKey: ["entries", entry.data?.world_id],
    queryFn: () => api.listEntries(entry.data!.world_id),
    enabled: !!entry.data,
  });

  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [bodyDoc, setBodyDoc] = useState<DocNode>(emptyDoc);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dirty, setDirty] = useState(0);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const latest = useRef<{ title: string; fields: Record<string, unknown>; bodyDoc: DocNode }>({
    title: "",
    fields: {},
    bodyDoc: emptyDoc,
  });
  latest.current = { title, fields, bodyDoc };

  useEffect(() => {
    const e = entry.data;
    if (!e) return;
    setTitle(e.title);
    setBodyDoc(e.body_doc);
    const f: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(e.fields)) {
      if (Array.isArray(v.value_doc)) {
        const mds = Array.isArray(v.value) ? (v.value as unknown[]) : [];
        f[k] = (v.value_doc as (DocNode | null)[]).map(
          (d, i) => d ?? strToDoc(String(mds[i] ?? "")),
        );
      } else if (v.value_doc) {
        f[k] = v.value_doc;
      } else if (Array.isArray(v.value)) {
        f[k] = (v.value as unknown[]).map(String);
      } else {
        f[k] = String(v.value ?? "");
      }
    }
    setFields(f);
  }, [entry.data]);

  const refresh = (e: Entry) => {
    qc.setQueryData(["entry", entryId], e);
    qc.invalidateQueries({ queryKey: ["entries", e.world_id] });
    qc.invalidateQueries({ queryKey: ["revisions", entryId] });
  };

  const save = useMutation({
    mutationFn: () =>
      api.updateEntry(entryId, {
        title: latest.current.title,
        fields: latest.current.fields,
        body_doc: latest.current.bodyDoc,
      }),
    onSuccess: ({ entry: e, warnings }) => {
      refresh(e);
      setWarnings(warnings ?? []);
      setSaveState("saved");
    },
    // Never fail silently: surface the error and offer a retry.
    onError: () => setSaveState("error"),
  });

  // Notion-style autosave: debounce user edits, no Save button.
  useEffect(() => {
    if (dirty === 0) return;
    setSaveState("saving");
    const t = setTimeout(() => save.mutate(), 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);
  const canonize = useMutation({
    mutationFn: (scope: { fields?: string[]; body?: boolean }) =>
      api.markCanon(entryId, scope),
    onSuccess: refresh,
  });

  // Every visible control doubles as a ⌘K command (shared tray state
  // with PinButton via the query cache).
  const tray = useQuery({
    queryKey: ["tray", entry.data?.world_id],
    queryFn: () => api.getTray(entry.data!.world_id),
    enabled: !!entry.data,
  });
  const pinned = (tray.data?.items ?? []).some(
    (i) => i.entry_id === entryId && i.source === "pinned",
  );
  const ed = entry.data;
  usePageCommands(
    ed?.world_id,
    ed
      ? [
          {
            id: "export",
            label: "Export entry as Markdown",
            hint: "download",
            run: () => {
              window.location.href = `/api/entries/${ed.id}/export`;
            },
          },
          {
            id: "pin",
            label: pinned ? "Unpin from AI context" : "Pin to AI context",
            run: async () => {
              if (pinned) await api.deletePin(ed.world_id, ed.id);
              else await api.createPin(ed.world_id, ed.id, false);
              qc.invalidateQueries({ queryKey: ["tray"] });
            },
          },
          ...(ed.status !== "canon"
            ? [
                {
                  id: "canon",
                  label: "Mark all canon",
                  run: () => canonize.mutate({}),
                },
              ]
            : []),
          {
            id: "history",
            label: showHistory
              ? "Hide revision history"
              : "Show revision history",
            run: () => setShowHistory((v) => !v),
          },
          {
            id: "delete",
            label: "Delete entry",
            hint: "destructive",
            run: async () => {
              if (confirm(`Delete "${ed.title}"?`)) {
                await api.deleteEntry(ed.id);
                navigate({ to: "/w/$worldId", params: { worldId: ed.world_id } });
              }
            },
          },
        ]
      : [],
  );

  const e = entry.data;
  if (entry.isError) {
    return (
      <div>
        {lastWorldId && <WorldSidebar worldId={lastWorldId} />}
        <div
          style={{ marginLeft: lastWorldId ? "var(--sidebar-w)" : 0 }}
          className="p-6 text-neutral-500"
        >
          Entry not found — it may have been deleted.{" "}
          <Link to="/" className="underline hover:text-neutral-300">
            Back to worlds
          </Link>
        </div>
      </div>
    );
  }
  if (!e) {
    // Keep the frame: sidebar stays (last known world), content shows a
    // skeleton — no full-page flash on cold navigations.
    return (
      <div>
        {lastWorldId && <WorldSidebar worldId={lastWorldId} currentEntryId={entryId} />}
        <div style={{ marginLeft: lastWorldId ? "var(--sidebar-w)" : 0 }}>
          <EntrySkeleton />
        </div>
      </div>
    );
  }
  lastWorldId = e.world_id;

  const schemaFields =
    world.data?.types.find((t) => t.id === e.type_id)?.fields ?? [];
  // Relation fields live in the relations panel, not the fields grid.
  const nonRelation = schemaFields.filter((f) => f.kind !== "relation");
  const fieldNames = [
    ...nonRelation.map((f) => f.name),
    ...Object.keys(e.fields).filter(
      (n) => !schemaFields.some((f) => f.name === n),
    ),
  ];
  const fieldLinkTargets = (worldEntries.data ?? []).filter(
    (c) => c.id !== e.id,
  );

  return (
    <div>
      <WorldSidebar worldId={e.world_id} currentEntryId={e.id} />
      <div style={{ marginLeft: "var(--sidebar-w)" }} className="max-w-4xl space-y-5 p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/w/$worldId"
            params={{ worldId: e.world_id }}
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            ← {world.data?.world.name ?? "world"}
          </Link>
          <span className="text-xs text-neutral-600">
            {e.type_name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <IconTip label="Export as Markdown">
            <a
              href={`/api/entries/${e.id}/export`}
              className="rounded-lg border border-neutral-700 px-2 py-1 text-sm text-neutral-500 hover:text-neutral-300"
            >
              <Download size={14} />
            </a>
          </IconTip>
          <Confirm
            title={`Delete "${e.title}"?`}
            body="The entry, its revisions, and its relations go with it."
            actionLabel="delete"
            onConfirm={async () => {
              await api.deleteEntry(e.id);
              navigate({ to: "/w/$worldId", params: { worldId: e.world_id } });
            }}
            trigger={
              <button className="rounded-lg border border-neutral-800 px-2 py-1 text-sm text-neutral-600 hover:border-red-900 hover:text-red-400">
                <Trash2 size={14} />
              </button>
            }
          />
          <PinButton worldId={e.world_id} entryId={e.id} />
          <StatusBadge status={e.status} />
          {e.status !== "canon" && (
            <button
              onClick={() => canonize.mutate({})}
              className="rounded-lg border border-neutral-500 px-3 py-1 text-sm text-neutral-100 hover:bg-neutral-800"
            >
              Mark all canon
            </button>
          )}
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty((d) => d + 1);
        }}
        placeholder="Untitled"
        className="w-full rounded bg-transparent px-1 text-2xl font-semibold outline-none placeholder:text-neutral-700 hover:bg-neutral-900 focus:bg-neutral-900"
      />

      <div className="space-y-1">
        {fieldNames.map((name) => {
          const fv = e.fields[name] as FieldValue | undefined;
          const kind = schemaFields.find((f) => f.name === name)?.kind ?? "string";
          // Draft content reads grey; canon reads white (the only
          // status distinction the content itself makes).
          const tone = fv?.status === "draft" ? "text-neutral-500" : "";
          const label = (
            <div className="flex w-44 shrink-0 items-start justify-end gap-2 pt-1 text-right text-xs text-neutral-500">
              <span className="truncate" title={name}>
                {titleCase(name)}
              </span>
              {fv && fv.status === "draft" && (
                <button
                  type="button"
                  title="Promote this field to canon"
                  onClick={() => canonize.mutate({ fields: [name] })}
                  className="shrink-0 rounded-full border border-neutral-800 px-1.5 text-xs lowercase text-neutral-500 hover:border-neutral-400 hover:text-white"
                >
                  draft
                </button>
              )}
            </div>
          );
          if (kind === "richtext_list") {
            const items = Array.isArray(fields[name])
              ? (fields[name] as unknown[])
              : [];
            return (
              <div key={name} className="flex gap-3">
                {label}
                <div className="min-w-0 flex-1">
                  {items.map((item, idx) => (
                    <div key={idx} className="mb-1 flex gap-1">
                      <div className={`w-full ${tone}`}>
                        <InlineField
                          doc={asFieldDoc(item)}
                          entries={fieldLinkTargets}
                          placeholder="— ('[[' links an entry)"
                          onChange={(d) => {
                            const next = [...items];
                            next[idx] = d;
                            setFields({ ...fields, [name]: next });
                            setDirty((n) => n + 1);
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setFields({
                            ...fields,
                            [name]: items.filter((_, i) => i !== idx),
                          })
                        }
                        className="text-neutral-600 hover:text-red-400"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setFields({ ...fields, [name]: [...items, strToDoc("")] })
                    }
                    className="rounded border border-dashed border-neutral-700 px-2 py-0.5 text-xs text-neutral-500 hover:text-neutral-300"
                  >
                    + add
                  </button>
                </div>
              </div>
            );
          }
          if (kind === "richtext") {
            return (
              <div key={name} className="flex gap-3">
                {label}
                <div className={`min-w-0 flex-1 ${tone}`}>
                  <InlineField
                    doc={asFieldDoc(fields[name])}
                    entries={fieldLinkTargets}
                    placeholder="— ('[[' links an entry)"
                    onChange={(d) => {
                      setFields({ ...fields, [name]: d });
                      setDirty((n) => n + 1);
                    }}
                  />
                </div>
              </div>
            );
          }
          return (
            <label key={name} className="flex gap-3">
              {label}
              <input
                value={typeof fields[name] === "string" ? (fields[name] as string) : ""}
                onChange={(ev) => {
                  setFields({ ...fields, [name]: ev.target.value });
                  setDirty((d) => d + 1);
                }}
                placeholder="—"
                className={`min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-neutral-700 hover:bg-neutral-900 focus:bg-neutral-900 ${tone}`}
              />
            </label>
          );
        })}
      </div>

      <RelationsPanel
        entry={e}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["entry", entryId] });
          qc.invalidateQueries({ queryKey: ["graph", entryId] });
        }}
      />

      <BodyEditor
        doc={bodyDoc}
        entries={(worldEntries.data ?? []).filter((c) => c.id !== e.id)}
        onChange={(d) => {
          setBodyDoc(d);
          setDirty((n) => n + 1);
        }}
      />

      <EgoGraph entryId={entryId} />

      {warnings.length > 0 && (
        <ul className="rounded-lg border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-300">
          {warnings.map((w) => (
            <li key={w} className="flex items-center gap-1.5">
              <TriangleAlert size={12} /> {w}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between text-xs text-neutral-600">
        <span>
          {saveState === "saving" ? (
            "saving…"
          ) : saveState === "saved" ? (
            "saved"
          ) : saveState === "error" ? (
            <span className="flex items-center gap-2 text-red-400">
              save failed
              <button
                type="button"
                onClick={() => {
                  setSaveState("saving");
                  save.mutate();
                }}
                className="rounded border border-red-900 px-2 hover:bg-red-950"
              >
                retry
              </button>
            </span>
          ) : (
            ""
          )}
        </span>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-300"
        >
          {revisions.data?.length ?? 0} revisions{" "}
          {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
      </div>

      {showHistory && (
        <ul className="space-y-2">
          {revisions.data?.map((rev) => (
            <RevisionRow
              key={rev.id}
              entryId={entryId}
              rev={rev}
              currentBody={e.body_md}
              onRestored={refresh}
            />
          ))}
        </ul>
      )}

      <ChatPanel worldId={e.world_id} currentEntryId={e.id} />
      </div>
    </div>
  );
}

function PinButton({ worldId, entryId }: { worldId: string; entryId: string }) {
  const qc = useQueryClient();
  const tray = useQuery({
    queryKey: ["tray", worldId],
    queryFn: () => api.getTray(worldId),
  });
  const pinned = (tray.data?.items ?? []).some(
    (i) => i.entry_id === entryId && i.source === "pinned",
  );
  const toggle = useMutation({
    mutationFn: async () => {
      if (pinned) await api.deletePin(worldId, entryId);
      else await api.createPin(worldId, entryId, false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tray"] }),
  });
  return (
    <button
      onClick={() => toggle.mutate()}
      title={pinned ? "Unpin from AI context" : "Pin to AI context"}
      className={`rounded-lg border px-2 py-1 text-sm ${
        pinned
          ? "border-sky-700 text-sky-300"
          : "border-neutral-700 text-neutral-500 hover:text-neutral-300"
      }`}
    >
      <Pin size={14} />
    </button>
  );
}