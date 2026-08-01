import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, TriangleAlert, X } from "lucide-react";
import { api, type FieldDef } from "./api";
import { Button, Picker, titleCase } from "./ui";

// Schema editing for humans (tenet 1: schemas are content too). Lives
// on the World meta entry. Field identity is the stable id (ADR 0015):
// renaming a field keeps its id, and the computed renames map migrates
// stored values; edges follow the id automatically.

const KINDS = [
  "string",
  "number",
  "date",
  "richtext",
  "richtext_list",
  "relation",
] as const;

type EditableField = FieldDef & { relation?: NonNullable<FieldDef["relation"]> };

function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: EditableField;
  onChange: (f: EditableField) => void;
  onRemove: () => void;
}) {
  const rel = field.relation ?? {};
  return (
    <div className="space-y-1 rounded border border-neutral-800 p-2">
      <div className="flex items-center gap-2">
        <input
          value={field.name}
          onChange={(e) => onChange({ ...field, name: e.target.value })}
          placeholder="field name"
          className="input w-40"
        />
        <Picker
          value={field.kind}
          onChange={(kind) =>
            onChange({
              ...field,
              kind,
              relation: kind === "relation" ? rel : undefined,
            })
          }
          placeholder="kind"
          items={KINDS.map((k) => ({ value: k, label: k }))}
        />
        <span className="flex-1" />
        <Button icon intent="danger" tip="Remove field" onClick={onRemove}>
          <X size={13} />
        </Button>
      </div>
      {field.kind === "relation" && (
        <div className="flex flex-wrap items-center gap-2 pl-1 text-neutral-400">
          <input
            value={(rel.targets ?? []).join(", ")}
            onChange={(e) =>
              onChange({
                ...field,
                relation: {
                  ...rel,
                  targets: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
              })
            }
            placeholder="target types (comma-sep; empty = any)"
            className="input w-72"
          />
          <input
            value={rel.inverse_label ?? ""}
            onChange={(e) =>
              onChange({
                ...field,
                relation: { ...rel, inverse_label: e.target.value },
              })
            }
            placeholder="inverse label"
            className="input w-44"
          />
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={rel.many ?? false}
              onChange={(e) =>
                onChange({ ...field, relation: { ...rel, many: e.target.checked } })
              }
            />
            many
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={rel.annotations ?? false}
              onChange={(e) =>
                onChange({
                  ...field,
                  relation: { ...rel, annotations: e.target.checked },
                })
              }
            />
            annotations
          </label>
        </div>
      )}
    </div>
  );
}

function TypeEditor({
  worldId,
  typeId,
  onDone,
}: {
  worldId: string;
  typeId: string | null; // null = create
  onDone: () => void;
}) {
  const qc = useQueryClient();
  const world = useQuery({
    queryKey: ["world", worldId],
    queryFn: () => api.getWorld(worldId),
  });
  const existing = world.data?.types.find((t) => t.id === typeId);
  // Own (non-inherited) fields only: the server stores each type's own
  // list; effective fields include ancestors and must not be re-saved.
  const ownFields = (existing?.fields ?? []).filter((f) => {
    if (!existing?.parent_id) return true;
    const parent = world.data?.types.find((t) => t.id === existing.parent_id);
    return !(parent?.fields ?? []).some((pf) => pf.id === f.id);
  });

  const [name, setName] = useState(existing?.name ?? "");
  const [parentId, setParentId] = useState(existing?.parent_id ?? "");
  const [fields, setFields] = useState<EditableField[]>(ownFields);
  const [warnings, setWarnings] = useState<string[]>([]);
  const originalNameByID = new Map(
    ownFields.filter((f) => f.id).map((f) => [f.id!, f.name]),
  );

  const save = useMutation({
    mutationFn: () => {
      if (typeId) {
        // Renames are computed by stable field id (ADR 0015).
        const renames: Record<string, string> = {};
        for (const f of fields) {
          const orig = f.id ? originalNameByID.get(f.id) : undefined;
          if (orig && orig !== f.name) renames[orig] = f.name;
        }
        return api.updateEntryType(worldId, typeId, { name, fields, renames });
      }
      return api.createEntryType(worldId, name, fields, parentId);
    },
    onSuccess: ({ warnings }) => {
      setWarnings(warnings ?? []);
      qc.invalidateQueries({ queryKey: ["world", worldId] });
      if (!warnings?.length) onDone();
    },
  });

  return (
    <div className="space-y-2 rounded border border-neutral-700 p-3">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="type name"
          className="input w-48"
        />
        {!typeId && (
          <Picker
            value={parentId}
            onChange={setParentId}
            placeholder="parent (optional)"
            items={(world.data?.types ?? [])
              .filter((t) => t.name !== "World")
              .map((t) => ({ value: t.id, label: t.name }))}
          />
        )}
      </div>
      {fields.map((f, i) => (
        <FieldRow
          key={f.id ?? `new-${i}`}
          field={f}
          onChange={(nf) => setFields(fields.map((x, j) => (j === i ? nf : x)))}
          onRemove={() => setFields(fields.filter((_, j) => j !== i))}
        />
      ))}
      <div className="flex items-center gap-2">
        <Button
          className="btn-add"
          onClick={() =>
            setFields([...fields, { name: "", kind: "string" } as EditableField])
          }
        >
          <Plus size={12} /> field
        </Button>
        <span className="flex-1" />
        <Button onClick={onDone}>cancel</Button>
        <Button
          intent="solid"
          disabled={!name.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          {typeId ? "save type" : "create type"}
        </Button>
      </div>
      {warnings.length > 0 && (
        <ul className="rounded border border-amber-900 bg-amber-950/40 p-2 text-amber-300">
          {warnings.map((w) => (
            <li key={w} className="flex items-center gap-1.5">
              <TriangleAlert size={12} /> {w}
            </li>
          ))}
          <li className="pt-1 text-neutral-400">
            Saved with warnings (soft schema) —{" "}
            <Button className="h-5 px-1.5" onClick={onDone}>
              done
            </Button>
          </li>
        </ul>
      )}
    </div>
  );
}

export function TypeManager({ worldId }: { worldId: string }) {
  const world = useQuery({
    queryKey: ["world", worldId],
    queryFn: () => api.getWorld(worldId),
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-2">
        {(world.data?.types ?? [])
          .filter((t) => t.name !== "World")
          .map((t) =>
            editing === t.id ? (
              <TypeEditor
                key={t.id}
                worldId={worldId}
                typeId={t.id}
                onDone={() => setEditing(null)}
              />
            ) : (
              <div key={t.id} className="flex h-7 items-center gap-2">
                <span className="w-40 truncate">{titleCase(t.name)}</span>
                <span className="min-w-0 flex-1 truncate text-neutral-600">
                  {(t.fields ?? []).map((f) => f.name).join(", ") || "no fields"}
                </span>
                <Button onClick={() => setEditing(t.id)}>edit</Button>
              </div>
            ),
          )}
        {creating ? (
          <TypeEditor
            worldId={worldId}
            typeId={null}
            onDone={() => setCreating(false)}
          />
        ) : (
          <Button className="btn-add" onClick={() => setCreating(true)}>
            <Plus size={12} /> new type
          </Button>
        )}
    </div>
  );
}
