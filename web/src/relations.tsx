import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, LockOpen, TriangleAlert, X } from "lucide-react";
import { PreviewCard } from "@base-ui/react/preview-card";
import { api, type Entry } from "./api";
import { Picker, surface, titleCase } from "./ui";

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
              {(sec.edges ?? []).map((edge) => {
                const pill = (
                  <span
                    className={`chip group relative min-w-0 max-w-full flex-nowrap overflow-hidden whitespace-nowrap ${
                      edge.status === "draft" ? "chip-draft" : "text-white"
                    }`}
                  >
                    <Link
                      to="/e/$entryId"
                      params={{ entryId: edge.to.id }}
                      className="max-w-56 shrink-0 truncate hover:underline"
                      title={edge.to.title}
                    >
                      {edge.to.title}
                    </Link>
                    {edge.annotation && (
                      <span
                        className="min-w-0 truncate text-neutral-500"
                        title={edge.annotation}
                      >
                        — {edge.annotation}
                      </span>
                    )}
                  </span>
                );
                if (system) return <span key={edge.id}>{pill}</span>;
                // Hover/focus controls anchor below the pill (Base UI
                // PreviewCard: positioning, hover intent, dismissal).
                return (
                  <PreviewCard.Root key={edge.id}>
                    <PreviewCard.Trigger render={pill} delay={150} />
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner
                        side="bottom"
                        align="start"
                        sideOffset={4}
                        className="z-30"
                      >
                        <PreviewCard.Popup
                          className={`flex items-center overflow-hidden text-xs ${surface}`}
                        >
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
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </PreviewCard.Root>
                );
              })}
              {system ? null : adding === secKey ? (
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
                  <button className="btn btn-solid">add</button>
                  <button
                    type="button"
                    onClick={() => setAdding(null)}
                    className="btn btn-icon"
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
                  className="btn btn-icon btn-add"
                >
                  +
                </button>
              )}
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