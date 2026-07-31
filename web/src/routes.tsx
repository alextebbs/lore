import { useEffect, useState } from "react";
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  useNavigate,
} from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Entry, type EntrySummary, type FieldValue } from "./api";

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <Link to="/" className="text-lg font-semibold tracking-wide">
          Lore
        </Link>
      </header>
      <main className="mx-auto max-w-3xl p-6">
        <Outlet />
      </main>
    </div>
  ),
});

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    canon: "bg-emerald-950 text-emerald-300 border-emerald-800",
    draft: "bg-amber-950 text-amber-300 border-amber-800",
    mixed: "bg-violet-950 text-violet-300 border-violet-800",
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
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Your worlds</h2>
      <ul className="space-y-2">
        {worlds.data?.map((w) => (
          <li key={w.id}>
            <Link
              to="/w/$worldId"
              params={{ worldId: w.id }}
              className="block rounded-lg border border-neutral-800 px-4 py-3 hover:border-neutral-600"
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

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">{world.data?.world.name}</h2>

      {[...grouped.entries()].map(([typeName, list]) => (
        <section key={typeName}>
          <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">
            {typeName}
          </h3>
          <ul className="space-y-1">
            {list.map((e) => (
              <li key={e.id}>
                <Link
                  to="/e/$entryId"
                  params={{ entryId: e.id }}
                  className="flex items-center justify-between rounded-lg border border-neutral-800 px-4 py-2 hover:border-neutral-600"
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
    </div>
  );
}

const worldRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/w/$worldId",
  component: WorldPage,
});

// ---------- Entry page ----------

// Renders body markdown with draft spans highlighted amber.
function BodyPreview({ md }: { md: string }) {
  const parts = md.split(/(\{~draft\}|\{\/~\})/);
  let draft = false;
  return (
    <div className="whitespace-pre-wrap rounded-lg border border-neutral-800 bg-neutral-900 p-4 text-sm leading-relaxed">
      {parts.map((p, i) => {
        if (p === "{~draft}") {
          draft = true;
          return null;
        }
        if (p === "{/~}") {
          draft = false;
          return null;
        }
        if (!p) return null;
        return draft ? (
          <span key={i} className="rounded bg-amber-950 text-amber-200">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        );
      })}
      {md === "" && <span className="text-neutral-600">No content yet.</span>}
    </div>
  );
}

function EntryPage() {
  const { entryId } = entryRoute.useParams();
  const qc = useQueryClient();
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

  const [title, setTitle] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [body, setBody] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    const e = entry.data;
    if (!e) return;
    setTitle(e.title);
    setBody(e.body_md);
    const f: Record<string, string> = {};
    for (const [k, v] of Object.entries(e.fields)) f[k] = String(v.value ?? "");
    setFields(f);
  }, [entry.data]);

  const refresh = (e: Entry) => {
    qc.setQueryData(["entry", entryId], e);
    qc.invalidateQueries({ queryKey: ["entries", e.world_id] });
    qc.invalidateQueries({ queryKey: ["revisions", entryId] });
  };

  const save = useMutation({
    mutationFn: () =>
      api.updateEntry(entryId, { title, fields, body_md: body }),
    onSuccess: ({ entry: e, warnings }) => {
      refresh(e);
      setWarnings(warnings ?? []);
    },
  });
  const canonize = useMutation({
    mutationFn: () => api.markCanon(entryId),
    onSuccess: refresh,
  });

  const e = entry.data;
  if (!e) return <p className="text-neutral-500">Loading…</p>;

  const schemaFields =
    world.data?.types.find((t) => t.id === e.type_id)?.fields ?? [];
  const fieldNames = [
    ...schemaFields.map((f) => f.name),
    ...Object.keys(e.fields).filter(
      (n) => !schemaFields.some((f) => f.name === n),
    ),
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/w/$worldId"
            params={{ worldId: e.world_id }}
            className="text-sm text-neutral-500 hover:text-neutral-300"
          >
            ← {world.data?.world.name ?? "world"}
          </Link>
          <span className="text-xs uppercase tracking-wide text-neutral-600">
            {e.type_name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={e.status} />
          {e.status !== "canon" && (
            <button
              onClick={() => canonize.mutate()}
              className="rounded-lg border border-emerald-800 px-3 py-1 text-sm text-emerald-300 hover:bg-emerald-950"
            >
              Mark all canon
            </button>
          )}
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-lg border border-transparent bg-transparent text-2xl font-semibold outline-none focus:border-neutral-700"
      />

      <div className="grid grid-cols-2 gap-3">
        {fieldNames.map((name) => (
          <label key={name} className="block">
            <span className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">
              {name}
              {e.fields[name] && (
                <StatusBadge status={(e.fields[name] as FieldValue).status} />
              )}
            </span>
            <input
              value={fields[name] ?? ""}
              onChange={(ev) =>
                setFields({ ...fields, [name]: ev.target.value })
              }
              className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-neutral-500"
            />
          </label>
        ))}
      </div>

      <div className="space-y-2">
        <span className="text-xs uppercase tracking-wide text-neutral-500">
          Body — markdown, {"{~draft}"}…{"{/~}"} marks draft spans
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-3 font-mono text-sm outline-none focus:border-neutral-500"
        />
        <BodyPreview md={body} />
      </div>

      {warnings.length > 0 && (
        <ul className="rounded-lg border border-amber-900 bg-amber-950/40 p-3 text-sm text-amber-300">
          {warnings.map((w) => (
            <li key={w}>⚠ {w}</li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="rounded-lg bg-neutral-100 px-4 py-2 font-medium text-neutral-900 disabled:opacity-50"
        >
          Save
        </button>
        <span className="text-xs text-neutral-600">
          {revisions.data?.length ?? 0} revisions
        </span>
      </div>
    </div>
  );
}

const entryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/e/$entryId",
  component: EntryPage,
});

export const routeTree = rootRoute.addChildren([
  indexRoute,
  worldRoute,
  entryRoute,
]);
