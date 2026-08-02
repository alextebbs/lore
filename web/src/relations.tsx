import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, Lock, LockOpen, TriangleAlert, X } from "lucide-react";
import { api, type Entry } from "./api";
import { Button, EntityChip, Picker, titleCase } from "./ui";

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
            (f: { name: string; kind: string }) =>
              f.name === field && f.kind === "relation",
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
              : satisfiesTargets(c.type_name, sec.config?.targets ?? undefined),
        );
        const secKey = sec.label + "|" + sec.field;
        const single = sec.config ? !sec.config.many : false;
        const occupied = (sec.edges ?? []).length > 0;
        return (
          <div key={secKey} className="flex gap-3">
            <div
              className="h-7 w-44 shrink-0 truncate text-right leading-7 text-neutral-500"
              title={sec.label || sec.field}
            >
              {titleCase(sec.label || sec.field)}
            </div>
            <div
              className={
                single
                  ? "min-w-0 flex-1 space-y-0.5"
                  : "flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5"
              }
            >
              {(sec.edges ?? []).map((edge) => (
                <div
                  key={edge.id}
                  className={`group flex h-7 items-center gap-1.5 ${
                    single ? "" : "max-w-full"
                  }`}
                >
                  <span
                    className={`flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap ${
                      single ? "flex-1" : ""
                    }`}
                  >
                    <EntityChip
                      id={edge.to.id}
                      title={edge.to.title}
                      draft={edge.status === "draft"}
                    />
                    {edge.annotation && (
                      <span
                        className={`min-w-0 truncate text-neutral-500 ${
                          single ? "" : "max-w-64"
                        }`}
                        title={edge.annotation}
                      >
                        — {edge.annotation}
                      </span>
                    )}
                  </span>
                  {/* Right rail: the row's controls, space always
                      reserved — nothing shifts, nothing pops over. */}
                  {!system && (
                    <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      <Button
                        icon
                        tip={
                          edge.status === "draft"
                            ? "Lock as canon"
                            : "Unlock to draft"
                        }
                        className="border-transparent"
                        onClick={() =>
                          setStatus.mutate({
                            id: edge.id,
                            status: edge.status === "draft" ? "canon" : "draft",
                          })
                        }
                      >
                        {/* Icon shows the CURRENT state; the tooltip
                            names the action. */}
                        {edge.status === "draft" ? (
                          <LockOpen size={13} />
                        ) : (
                          <Lock size={13} />
                        )}
                      </Button>
                      <Button
                        icon
                        intent="danger"
                        tip="Remove relation"
                        className="border-transparent"
                        onClick={() => remove.mutate(edge.id)}
                      >
                        <X size={13} />
                      </Button>
                    </span>
                  )}
                </div>
              ))}
              {/* Add (or replace, for occupied single-slot relations)
                  lives on its own line beneath the rows. */}
              {!system &&
                (adding === secKey ? (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (target)
                        create.mutate({ field: sec.field, reverse: sec.reverse });
                    }}
                  >
                    <Picker
                      value={target}
                      onChange={setTarget}
                      placeholder="choose…"
                      autoFocus
                      items={candidates.map((c) => ({
                        value: c.id,
                        label: `${c.title} (${c.type_name})`,
                      }))}
                    />
                    {sec.config?.annotations && (
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="annotation"
                        className="input w-40"
                      />
                    )}
                    <Button intent="solid" type="submit">
                      {single && occupied ? "replace" : "add"}
                    </Button>
                    <Button icon tip="Cancel" onClick={() => setAdding(null)}>
                      <X size={13} />
                    </Button>
                  </form>
                ) : single && occupied ? (
                  <Button
                    className="btn-add"
                    tip={`Replace the current ${sec.field}`}
                    onClick={() => {
                      setAdding(secKey);
                      setTarget("");
                      setNote("");
                    }}
                  >
                    <ArrowLeftRight size={12} /> replace
                  </Button>
                ) : (
                  <Button
                    className="btn-add"
                    tip={
                      sec.reverse
                        ? `Relate an entry to this one via ${sec.field}`
                        : `Add ${sec.field}`
                    }
                    onClick={() => {
                      setAdding(secKey);
                      setTarget("");
                      setNote("");
                    }}
                  >
                    + add
                  </Button>
                ))}
            </div>
          </div>
        );
      })}

      {warnings.length > 0 && (
        <ul className="rounded border border-amber-900 bg-amber-950/40 p-2 text-amber-300">
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