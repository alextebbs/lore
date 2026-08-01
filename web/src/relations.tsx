import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, LockOpen, TriangleAlert, X } from "lucide-react";
import { api, type Entry } from "./api";
import { titleCase } from "./ui";

export function RelationsPanel({
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
                    <span className="invisible absolute left-0 top-full z-20 pt-1 group-hover:visible group-focus-within:visible">
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