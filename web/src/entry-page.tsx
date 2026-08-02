import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Ellipsis,
  History,
  Pin,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { api, type Entry } from "./api";
import { BodyEditor } from "./editor";
import { usePageCommands } from "./palette";
import { ChatPanel } from "./chat";
import { EgoGraph } from "./graph";
import { emptyDoc, type DocNode } from "./doc";
import { Menu } from "@base-ui/react/menu";
import { Popover } from "@base-ui/react/popover";
import { Button, Confirm, EntrySkeleton, StatusBadge, age, strToDoc } from "./ui";
import { WorldSidebar } from "./sidebar";
import { appState } from "./app-state";
import { RelationsPanel } from "./relations";
import { RevisionsDrawer } from "./revisions-drawer";
import { FieldsGrid } from "./fields-grid";


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
  const [deleteOpen, setDeleteOpen] = useState(false);
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
            run: () => setDeleteOpen(true),
          },
          {
            id: "new-entry",
            label: "New entry…",
            run: () => appState.openNewEntry(),
          },
          {
            id: "settings",
            label: "World settings & export",
            run: () =>
              navigate({
                to: "/w/$worldId/settings",
                params: { worldId: ed.world_id },
              }),
          },
          {
            id: "schema",
            label: "Entry types…",
            run: () =>
              navigate({
                to: "/w/$worldId/schema",
                params: { worldId: ed.world_id },
              }),
          },
        ]
      : [],
  );

  const e = entry.data;
  if (entry.isError) {
    return (
      <div>
        {appState.lastWorldId && <WorldSidebar worldId={appState.lastWorldId} />}
        <div
          style={{ marginLeft: appState.lastWorldId ? "var(--sidebar-w)" : 0 }}
          className="p-6 text-stone-500"
        >
          Entry not found — it may have been deleted.{" "}
          <Link to="/" className="underline hover:text-stone-300">
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
        {appState.lastWorldId && <WorldSidebar worldId={appState.lastWorldId} currentEntryId={entryId} />}
        <div style={{ marginLeft: appState.lastWorldId ? "var(--sidebar-w)" : 0 }}>
          <EntrySkeleton />
        </div>
      </div>
    );
  }
  appState.lastWorldId = e.world_id;

  const schemaFields =
    world.data?.types.find((t) => t.id === e.type_id)?.fields ?? [];
  const fieldLinkTargets = (worldEntries.data ?? []).filter(
    (c) => c.id !== e.id,
  );

  return (
    <div>
      <WorldSidebar worldId={e.world_id} currentEntryId={e.id} />
      <div style={{ marginLeft: "var(--sidebar-w)" }} className="max-w-4xl space-y-5 p-6">
      <div className="flex items-center justify-end gap-2">
          {saveState === "saving" ? (
            <span className="text-stone-600">saving…</span>
          ) : (
            revisions.data?.[0] && (
              <Button
                className="border-transparent text-stone-600"
                tip="Revision history"
                onClick={() => setShowHistory(true)}
              >
                saved {age(revisions.data[0].created_at)}
              </Button>
            )
          )}
          {saveState === "error" && (
            <Button
              intent="danger"
              onClick={() => {
                setSaveState("saving");
                save.mutate();
              }}
            >
              save failed — retry
            </Button>
          )}
          {warnings.length > 0 && (
            <Popover.Root>
              <Popover.Trigger
                aria-label={`${warnings.length} warnings`}
                render={
                  <Button icon intent="warning">
                    <TriangleAlert size={14} />
                  </Button>
                }
              />
              <Popover.Portal>
                <Popover.Positioner side="bottom" align="end" sideOffset={6} className="z-40">
                  <Popover.Popup className="anim-fade panel max-w-md space-y-1 p-3 text-amber-300">
                    {warnings.map((w) => (
                      <div key={w} className="flex items-center gap-1.5">
                        <TriangleAlert size={12} /> {w}
                      </div>
                    ))}
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          )}
          <PinButton worldId={e.world_id} entryId={e.id} />
          <Menu.Root>
            <Menu.Trigger
              render={
                <Button icon tip="More">
                  <Ellipsis size={14} />
                </Button>
              }
            />
            <Menu.Portal>
              <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-40">
                <Menu.Popup className="anim-fade panel min-w-52 overflow-hidden py-1 outline-none">
                  <Menu.Item
                    render={
                      <a
                        href={`/api/entries/${e.id}/export`}
                        className="flex w-full cursor-default items-center gap-1.5 px-3 py-1.5 text-stone-300 data-[highlighted]:bg-stone-800 data-[highlighted]:text-white"
                      >
                        <Download size={13} /> Export as Markdown
                      </a>
                    }
                  />
                  <Menu.Item
                    onClick={() => setShowHistory(true)}
                    className="flex w-full cursor-default items-center gap-1.5 px-3 py-1.5 text-stone-300 data-[highlighted]:bg-stone-800 data-[highlighted]:text-white"
                  >
                    <History size={13} /> Revision history (
                    {revisions.data?.length ?? 0})
                  </Menu.Item>
                  <Menu.Item
                    onClick={() => setDeleteOpen(true)}
                    className="flex w-full cursor-default items-center gap-1.5 px-3 py-1.5 text-red-400 data-[highlighted]:bg-red-950/40"
                  >
                    <Trash2 size={13} /> Delete entry
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Confirm
            title={`Delete "${e.title}"?`}
            body="The entry, its revisions, and its relations go with it."
            actionLabel="delete"
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            onConfirm={async () => {
              await api.deleteEntry(e.id);
              navigate({ to: "/w/$worldId", params: { worldId: e.world_id } });
            }}
          />
          <StatusBadge status={e.status} />
          {e.status !== "canon" && (
            <Button intent="solid" onClick={() => canonize.mutate({})}>
              Mark all canon
            </Button>
          )}
      </div>

      <div>
        <div className="px-1 text-stone-600">{e.type_name}</div>
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setDirty((d) => d + 1);
          }}
          placeholder="Untitled"
          className="display display-lg w-full rounded bg-transparent px-1 outline-none placeholder:text-stone-700 hover:bg-stone-900 focus:bg-stone-900"
        />
      </div>

      <FieldsGrid
        entry={e}
        schemaFields={schemaFields}
        fields={fields}
        setFields={setFields}
        bump={() => setDirty((n) => n + 1)}
        onCanonizeField={(name) => canonize.mutate({ fields: [name] })}
        fieldLinkTargets={fieldLinkTargets}
      />

      <RelationsPanel
        entry={e}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["entry", entryId] });
          qc.invalidateQueries({ queryKey: ["graph", entryId] });
        }}
      />

      {/* Body aligns with the field-value column. */}
      <div className="flex gap-3">
        <div className="w-44 shrink-0" />
        <div className="min-w-0 flex-1">
          <BodyEditor
            doc={bodyDoc}
            entries={(worldEntries.data ?? []).filter((c) => c.id !== e.id)}
            onChange={(d) => {
              setBodyDoc(d);
              setDirty((n) => n + 1);
            }}
          />
        </div>
      </div>

      {/* Mentions derive from the body — they read below it. */}
      <RelationsPanel
        entry={e}
        mentions
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["entry", entryId] });
          qc.invalidateQueries({ queryKey: ["graph", entryId] });
        }}
      />

      <EgoGraph entryId={entryId} />

      <RevisionsDrawer
        entry={e}
        revisions={revisions.data ?? []}
        open={showHistory}
        onOpenChange={setShowHistory}
        onRestored={refresh}
      />

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
    <Button
      icon
      active={pinned}
      tip={pinned ? "Unpin from AI context" : "Pin to AI context"}
      onClick={() => toggle.mutate()}
    >
      <Pin size={14} />
    </Button>
  );
}