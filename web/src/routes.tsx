import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  useNavigate,
} from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type Entry,
  type EntrySummary,
  type FieldValue,
  type Revision as RevisionType,
} from "./api";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Home,
  Lock,
  LockOpen,
  Pin,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { BodyEditor, InlineField } from "./editor";
import { CommandPalette, usePageCommands } from "./palette";
import { ChatPanel } from "./chat";
import { EgoGraph } from "./graph";
import { diffWords } from "./diff";
import { emptyDoc, type DocNode } from "./doc";

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <main>
        <Outlet />
      </main>
      <CommandPalette />
    </div>
  ),
});

const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    canon: "border-neutral-500 text-neutral-100",
    draft: "border-neutral-800 text-neutral-500",
    mixed: "border-neutral-700 text-neutral-400",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs ${styles[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

// ---------- Worlds index ----------

function WorldsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const worlds = useQuery({ queryKey: ["worlds"], queryFn: api.listWorlds });
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => api.createWorld(name.trim()),
    onSuccess: (w) => {
      qc.invalidateQueries({ queryKey: ["worlds"] });
      navigate({ to: "/w/$worldId", params: { worldId: w.id } });
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h2 className="text-xl font-semibold">Your worlds</h2>
      <ul className="space-y-2">
        {worlds.data?.map((w) => (
          <li key={w.id}>
            <Link
              to="/w/$worldId"
              params={{ worldId: w.id }}
              className="block rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 hover:border-neutral-600"
            >
              {w.name}
            </Link>
          </li>
        ))}
        {worlds.data?.length === 0 && (
          <li className="text-neutral-500">No worlds yet — create one.</li>
        )}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New world name"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-500"
        />
        <button
          className="rounded-lg bg-neutral-100 px-4 py-2 font-medium text-neutral-900 disabled:opacity-50"
          disabled={create.isPending}
        >
          Create
        </button>
      </form>
    </div>
  );
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: WorldsPage,
});

// ---------- World sidebar (Notion-style) ----------

// Sidebar scroll survives route remounts (module-scoped, per world).
const sidebarScroll: Record<string, number> = {};

// Sidebar width lives in a CSS variable so the fixed nav and the
// content margin stay in lockstep while dragging; persisted per user.
const SIDEBAR_WIDTH_KEY = "lore:sidebar-width";
document.documentElement.style.setProperty(
  "--sidebar-w",
  `${Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || 240}px`,
);

function startSidebarResize(e: React.MouseEvent) {
  e.preventDefault();
  const move = (ev: MouseEvent) => {
    const w = Math.min(480, Math.max(180, ev.clientX));
    document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
  };
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    document.body.style.cursor = "";
  };
  document.body.style.cursor = "col-resize";
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

function WorldSidebar({
  worldId,
  currentEntryId,
}: {
  worldId: string;
  currentEntryId?: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (navRef.current) navRef.current.scrollTop = sidebarScroll[worldId] ?? 0;
  }, [worldId]);
  const entries = useQuery({
    queryKey: ["entries", worldId],
    queryFn: () => api.listEntries(worldId),
  });
  // Filter-as-you-type narrows the list in place; without a query,
  // groups cap at GROUP_CAP with a per-group "show all" toggle
  // (Slack-style) so the unfiltered sidebar stays scannable.
  const GROUP_CAP = 8;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();
  const grouped = new Map<string, EntrySummary[]>();
  for (const e of entries.data ?? []) {
    if (q && !e.title.toLowerCase().includes(q)) continue;
    grouped.set(e.type_name, [...(grouped.get(e.type_name) ?? []), e]);
  }
  const typeNames = [...grouped.keys()].sort((a, b) =>
    a === "World" ? -1 : b === "World" ? 1 : a.localeCompare(b),
  );
  return (
    <nav
      ref={navRef}
      onScroll={(e) => {
        sidebarScroll[worldId] = e.currentTarget.scrollTop;
      }}
      style={{ width: "var(--sidebar-w)" }}
      className="fixed inset-y-0 left-0 overflow-y-auto border-r border-neutral-800 bg-neutral-950 px-3 py-4 text-sm"
    >
      <div
        onMouseDown={startSidebarResize}
        title="Drag to resize"
        className="fixed inset-y-0 z-30 w-1.5 cursor-col-resize hover:bg-neutral-700"
        style={{ left: "calc(var(--sidebar-w) - 3px)" }}
      />
      <Link
        to="/"
        className="mb-4 block text-lg font-semibold tracking-wide text-neutral-100 hover:text-white"
      >
        Lore
      </Link>
      <Link
        to="/w/$worldId"
        params={{ worldId }}
        className="mb-3 flex items-center gap-1.5 font-semibold text-neutral-200 hover:text-white"
      >
        <Home size={14} /> Overview
      </Link>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setQuery("");
        }}
        placeholder="search…"
        className="mb-3 w-full rounded bg-neutral-900 px-2 py-1 text-sm outline-none placeholder:text-neutral-600 focus:bg-neutral-800"
      />
      {q && typeNames.length === 0 && (
        <div className="text-neutral-600">no matches</div>
      )}
      {typeNames.map((typeName) => {
        const all = grouped.get(typeName)!;
        const open = q !== "" || expanded[typeName];
        const shown = open ? all : all.slice(0, GROUP_CAP);
        return (
          <div key={typeName} className="mb-3">
            <div className="mb-1 text-xs text-neutral-600">
              {typeName}
            </div>
            <ul>
              {shown.map((e) => (
                <li key={e.id}>
                  <Link
                    to="/e/$entryId"
                    params={{ entryId: e.id }}
                    className={`block truncate rounded px-2 py-0.5 ${
                      e.id === currentEntryId
                        ? "bg-neutral-800 text-white"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
                    }`}
                    title={e.title}
                  >
                    {e.title}
                    {e.status !== "canon" && (
                      <span className="ml-1 text-neutral-600">•</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            {!q && all.length > GROUP_CAP && (
              <button
                type="button"
                onClick={() =>
                  setExpanded({ ...expanded, [typeName]: !expanded[typeName] })
                }
                className="mt-0.5 inline-flex items-center gap-1 px-2 text-xs text-neutral-600 hover:text-neutral-300"
              >
                {expanded[typeName] ? (
                  "show less"
                ) : (
                  <>
                    show all {all.length} <ChevronRight size={12} />
                  </>
                )}
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function WorldSettingsPanel({ worldId }: { worldId: string }) {
  const qc = useQueryClient();
  const world = useQuery({
    queryKey: ["world", worldId],
    queryFn: () => api.getWorld(worldId),
  });
  const s = world.data?.world.settings ?? {};
  const [vibe, setVibe] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [authorAs, setAuthorAs] = useState<string | null>(null);
  const [aiCanon, setAiCanon] = useState<boolean | null>(null);
  const save = useMutation({
    mutationFn: () =>
      api.updateWorldSettings(worldId, {
        vibe: vibe ?? s.vibe ?? "",
        style_prompt: style ?? s.style_prompt ?? "",
        humans_author_as: (authorAs ?? s.humans_author_as ?? "canon") as
          | "draft"
          | "canon",
        ai_can_edit_canon: aiCanon ?? s.ai_can_edit_canon ?? false,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["world", worldId] }),
  });
  return (
    <details className="rounded-lg border border-neutral-800 p-3 text-sm">
      <summary className="cursor-pointer text-neutral-400">
        World settings
      </summary>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="text-xs text-neutral-500">
            Vibe — global context for the AI ("It's Elden Ring", …)
          </span>
          <textarea
            defaultValue={s.vibe ?? ""}
            onChange={(e) => setVibe(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 p-2"
          />
        </label>
        <label className="block">
          <span className="text-xs text-neutral-500">
            Style prompt — primes AI writing (e.g. WoTC sourcebook voice)
          </span>
          <textarea
            defaultValue={s.style_prompt ?? ""}
            onChange={(e) => setStyle(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-neutral-800 bg-neutral-900 p-2"
          />
        </label>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">
              Humans author as
            </span>
            <select
              defaultValue={s.humans_author_as ?? "canon"}
              onChange={(e) => setAuthorAs(e.target.value)}
              className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1"
            >
              <option value="canon">canon</option>
              <option value="draft">draft</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              defaultChecked={s.ai_can_edit_canon ?? false}
              onChange={(e) => setAiCanon(e.target.checked)}
            />
            <span className="text-xs text-neutral-500">
              AI can modify/delete canon
            </span>
          </label>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="rounded bg-neutral-100 px-3 py-1 text-neutral-900"
          >
            Save settings
          </button>
          <button
            onClick={async () => {
              if (confirm("Delete this world and everything in it?")) {
                await api.deleteWorld(worldId);
                window.location.href = "/";
              }
            }}
            className="text-xs text-red-500 hover:text-red-300"
          >
            delete world
          </button>
        </div>
      </div>
    </details>
  );
}

// ---------- World home ----------

function WorldPage() {
  const { worldId } = worldRoute.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const world = useQuery({
    queryKey: ["world", worldId],
    queryFn: () => api.getWorld(worldId),
  });
  const entries = useQuery({
    queryKey: ["entries", worldId],
    queryFn: () => api.listEntries(worldId),
  });
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState("");
  const create = useMutation({
    mutationFn: () => api.createEntry(worldId, typeId, title.trim()),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ["entries", worldId] });
      navigate({ to: "/e/$entryId", params: { entryId: e.id } });
    },
  });

  const grouped = new Map<string, EntrySummary[]>();
  for (const e of entries.data ?? []) {
    grouped.set(e.type_name, [...(grouped.get(e.type_name) ?? []), e]);
  }

  usePageCommands(worldId, [
    {
      id: "export-vault",
      label: "Export vault (Obsidian zip)",
      hint: "download",
      run: () => {
        window.location.href = `/api/worlds/${worldId}/export`;
      },
    },
    {
      id: "export-dump",
      label: "Export world dump (JSON fixture)",
      hint: "download",
      run: () => window.open(`/api/worlds/${worldId}/dump`, "_blank"),
    },
    {
      id: "new-entry",
      label: "New entry…",
      run: () =>
        document
          .querySelector<HTMLInputElement>('input[placeholder="New entry title"]')
          ?.focus(),
    },
    {
      id: "settings",
      label: "World settings",
      run: () => {
        const d = document.querySelector("details");
        if (d) {
          d.open = true;
          d.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      },
    },
  ]);

  return (
    <div>
      <WorldSidebar worldId={worldId} />
      <div style={{ marginLeft: "var(--sidebar-w)" }} className="max-w-4xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{world.data?.world.name}</h2>
        <a
          href={`/api/worlds/${worldId}/export`}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300"
          title="Download Obsidian-style vault (zip)"
        >
          <Download size={12} /> export vault
        </a>
      </div>

      {[...grouped.entries()].map(([typeName, list]) => (
        <section key={typeName}>
          <h3 className="mb-2 text-sm font-medium text-neutral-500">
            {typeName}
          </h3>
          <ul className="space-y-1">
            {list.map((e) => (
              <li key={e.id}>
                <Link
                  to="/e/$entryId"
                  params={{ entryId: e.id }}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 hover:border-neutral-600"
                >
                  <span>{e.title}</span>
                  <StatusBadge status={e.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {entries.data?.length === 0 && (
        <p className="text-neutral-500">Empty world — create the first entry.</p>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (title.trim() && typeId) create.mutate();
        }}
      >
        <select
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
        >
          <option value="">Type…</option>
          {world.data?.types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New entry title"
          className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 outline-none focus:border-neutral-500"
        />
        <button
          className="rounded-lg bg-neutral-100 px-4 py-2 font-medium text-neutral-900 disabled:opacity-50"
          disabled={create.isPending}
        >
          Add
        </button>
      </form>

      <WorldSettingsPanel worldId={worldId} />
      <ChatPanel worldId={worldId} />
      </div>
    </div>
  );
}

const worldRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/w/$worldId",
  component: WorldPage,
});

// ---------- Entry page ----------

function RelationsPanel({
  entry,
  onChanged,
}: {
  entry: Entry;
  onChanged: () => void;
}) {
  const allEntries = useQuery({
    queryKey: ["entries", entry.world_id],
    queryFn: () => api.listEntries(entry.world_id),
  });
  const [adding, setAdding] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  const create = useMutation({
    // Reverse sections author the edge in its canonical direction:
    // the chosen entry points here through its own field.
    mutationFn: ({ field, reverse }: { field: string; reverse?: boolean }) =>
      reverse
        ? api.createEdge(target, field, entry.id, note)
        : api.createEdge(entry.id, field, target, note),
    onSuccess: ({ warnings }) => {
      setWarnings(warnings ?? []);
      setAdding(null);
      setTarget("");
      setNote("");
      onChanged();
    },
  });
  const remove = useMutation({
    mutationFn: (edgeId: string) => api.deleteEdge(edgeId),
    onSuccess: onChanged,
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "draft" | "canon" }) =>
      api.updateEdgeStatus(id, status),
    onSuccess: onChanged,
  });

  const world = useQuery({
    queryKey: ["world", entry.world_id],
    queryFn: () => api.getWorld(entry.world_id),
  });
  // Subtype-aware target matching: a City counts as a Place.
  const parentOf = new Map(
    (world.data?.types ?? []).map((t) => [t.id, t.parent_id]),
  );
  const nameOf = new Map((world.data?.types ?? []).map((t) => [t.id, t.name]));
  const idOf = new Map((world.data?.types ?? []).map((t) => [t.name, t.id]));
  const satisfiesTargets = (typeName: string, targets?: string[]) => {
    if (!targets?.length) return true;
    let id = idOf.get(typeName);
    while (id) {
      const n = nameOf.get(id);
      if (n && targets.includes(n)) return true;
      id = parentOf.get(id) ?? undefined;
    }
    return false;
  };

  const sections = entry.relations ?? [];
  if (sections.length === 0) return null;

  // Candidates for a reverse add: entries whose type declares the field.
  const typesDeclaring = (field: string) =>
    new Set(
      (world.data?.types ?? [])
        .filter((t) =>
          (t.fields ?? []).some(
            (f) => f.name === field && f.kind === "relation",
          ),
        )
        .map((t) => t.name),
    );

  return (
    <div className="space-y-1">
      {sections.map((sec) => {
        const system = sec.field === "mentions";
        const declaring = sec.reverse ? typesDeclaring(sec.field) : null;
        const candidates = (allEntries.data ?? []).filter((c) =>
          c.id === entry.id
            ? false
            : sec.reverse
              ? declaring!.has(c.type_name)
              : satisfiesTargets(c.type_name, sec.config?.targets),
        );
        const secKey = sec.label + "|" + sec.field;
        return (
          <div key={secKey} className="flex gap-3">
            <div
              className="w-44 shrink-0 truncate pt-2 text-right text-xs text-neutral-500"
              title={sec.label || sec.field}
            >
              {titleCase(sec.label || sec.field)}
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {(sec.edges ?? []).map((edge) => (
                <span
                  key={edge.id}
                  className={`group relative flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                    edge.status === "draft"
                      ? "border-neutral-800 text-neutral-500"
                      : "border-neutral-700"
                  }`}
                >
                  <Link
                    to="/e/$entryId"
                    params={{ entryId: edge.to.id }}
                    className="hover:underline"
                  >
                    {edge.to.title}
                  </Link>
                  {edge.annotation && (
                    <span className="text-xs text-neutral-500">
                      — {edge.annotation}
                    </span>
                  )}
                  {/* Hover controls float below the pill — no layout
                      shift. The pt-1 wrapper bridges the hover gap. */}
                  {!system && (
                    <span className="invisible absolute left-0 top-full z-20 pt-1 group-hover:visible">
                      <span className="flex items-center overflow-hidden rounded-lg border border-neutral-700 bg-neutral-900 text-xs shadow-xl">
                        <button
                          type="button"
                          title={
                            edge.status === "draft"
                              ? "Lock as canon"
                              : "Unlock to draft"
                          }
                          onClick={() =>
                            setStatus.mutate({
                              id: edge.id,
                              status:
                                edge.status === "draft" ? "canon" : "draft",
                            })
                          }
                          className="px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-white"
                        >
                          {edge.status === "draft" ? (
                            <Lock size={13} />
                          ) : (
                            <LockOpen size={13} />
                          )}
                        </button>
                        <span className="h-4 w-px bg-neutral-700" />
                        <button
                          type="button"
                          title="Remove relation"
                          onClick={() => remove.mutate(edge.id)}
                          className="px-2 py-1 text-neutral-400 hover:bg-neutral-800 hover:text-red-400"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    </span>
                  )}
                </span>
              ))}
              {system ? null : adding === secKey ? (
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (target)
                      create.mutate({ field: sec.field, reverse: sec.reverse });
                  }}
                >
                  <select
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
                    autoFocus
                  >
                    <option value="">choose…</option>
                    {candidates.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.type_name})
                      </option>
                    ))}
                  </select>
                  {sec.config?.annotations && (
                    <input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="annotation"
                      className="w-40 rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm"
                    />
                  )}
                  <button className="rounded bg-neutral-200 px-2 py-1 text-sm text-neutral-900">
                    add
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdding(null)}
                    className="px-1 text-neutral-500"
                  >
                    <X size={13} />
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => {
                    setAdding(secKey);
                    setTarget("");
                    setNote("");
                  }}
                  title={
                    sec.reverse
                      ? `Relate an entry to this one via ${sec.field}`
                      : `Add ${sec.field}`
                  }
                  className="rounded-full border border-dashed border-neutral-700 px-3 py-1 text-sm text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
                >
                  +
                </button>
              )}
            </div>
          </div>
        );
      })}

      {warnings.length > 0 && (
        <ul className="rounded-lg border border-amber-900 bg-amber-950/40 p-2 text-xs text-amber-300">
          {warnings.map((w) => (
            <li key={w} className="flex items-center gap-1.5">
              <TriangleAlert size={12} /> {w}
            </li>
          ))}
        </ul>
      )}

    </div>
  );
}

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

function EntryPage() {
  const { entryId } = entryRoute.useParams();
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
  const [fields, setFields] = useState<Record<string, string | string[]>>({});
  const [bodyDoc, setBodyDoc] = useState<DocNode>(emptyDoc);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dirty, setDirty] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const latest = useRef<{ title: string; fields: Record<string, string | string[]>; bodyDoc: DocNode }>({
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
    const f: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(e.fields)) {
      f[k] = Array.isArray(v.value)
        ? (v.value as unknown[]).map(String)
        : String(v.value ?? "");
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
  if (!e) return <p className="text-neutral-500">Loading…</p>;

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
          <a
            href={`/api/entries/${e.id}/export`}
            className="rounded-lg border border-neutral-700 px-2 py-1 text-sm text-neutral-500 hover:text-neutral-300"
            title="Export as Markdown"
          >
            <Download size={14} />
          </a>
          <button
            title="Delete entry"
            onClick={async () => {
              if (confirm(`Delete "${e.title}"?`)) {
                await api.deleteEntry(e.id);
                navigate({ to: "/w/$worldId", params: { worldId: e.world_id } });
              }
            }}
            className="rounded-lg border border-neutral-800 px-2 py-1 text-sm text-neutral-600 hover:border-red-900 hover:text-red-400"
          >
            <Trash2 size={14} />
          </button>
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
              ? (fields[name] as string[])
              : fields[name]
                ? [String(fields[name])]
                : [];
            return (
              <div key={name} className="flex gap-3">
                {label}
                <div className="min-w-0 flex-1">
                  {items.map((item, idx) => (
                    <div key={idx} className="mb-1 flex gap-1">
                      <div className={`w-full ${tone}`}>
                        <InlineField
                          value={item}
                          entries={fieldLinkTargets}
                          placeholder="— ('[[' links an entry)"
                          onChange={(v) => {
                            const next = [...items];
                            next[idx] = v;
                            setFields({ ...fields, [name]: next });
                            setDirty((d) => d + 1);
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
                    onClick={() => setFields({ ...fields, [name]: [...items, ""] })}
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
                    value={typeof fields[name] === "string" ? (fields[name] as string) : ""}
                    entries={fieldLinkTargets}
                    placeholder="— ('[[' links an entry)"
                    onChange={(v) => {
                      setFields({ ...fields, [name]: v });
                      setDirty((d) => d + 1);
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
          {saveState === "saving"
            ? "saving…"
            : saveState === "saved"
              ? "saved"
              : ""}
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

const entryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/e/$entryId",
  // Key by entryId: navigating entry→entry must remount, or a pending
  // debounced autosave from the old entry writes onto the new one.
  component: function EntryRoute() {
    const { entryId } = entryRoute.useParams();
    return <EntryPage key={entryId} />;
  },
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  worldRoute,
  entryRoute,
]);
