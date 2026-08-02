import type { Entry, EntrySummary, FieldValue } from "./api";
import type { FieldDef } from "./api";
import { InlineField } from "./editor";
import { Button, asFieldDoc, strToDoc, titleCase } from "./ui";

// The left/right property grid: one row per schema field (plus any
// undeclared stored fields), draft content grey, richtext kinds edited
// as docs with mention chips.
export function FieldsGrid({
  entry: e,
  schemaFields,
  fields,
  setFields,
  bump,
  onCanonizeField,
  fieldLinkTargets,
}: {
  entry: Entry;
  schemaFields: FieldDef[];
  fields: Record<string, unknown>;
  setFields: (f: Record<string, unknown>) => void;
  bump: () => void;
  onCanonizeField: (name: string) => void;
  fieldLinkTargets: EntrySummary[];
}) {
  const nonRelation = schemaFields.filter((f) => f.kind !== "relation");
  const fieldNames = [
    ...nonRelation.map((f) => f.name),
    ...Object.keys(e.fields).filter(
      (n) => !schemaFields.some((f) => f.name === n),
    ),
  ];
  return (
      <div className="space-y-1">
        {fieldNames.map((name) => {
          const fv = e.fields[name] as FieldValue | undefined;
          const kind = schemaFields.find((f) => f.name === name)?.kind ?? "string";
          // Draft content reads grey; canon reads white (the only
          // status distinction the content itself makes).
          const tone = fv?.status === "draft" ? "text-neutral-500" : "";
          const label = (
            <div className="flex h-7 w-44 shrink-0 items-center justify-end gap-2 text-right leading-7 text-neutral-500">
              <span className="truncate" title={name}>
                {titleCase(name)}
              </span>
              {fv && fv.status === "draft" && (
                <Button
                  tip="Promote this field to canon"
                  className="h-5 shrink-0 px-1.5 lowercase"
                  onClick={() => onCanonizeField(name)}
                >
                  draft
                </Button>
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
                    <div key={idx} className="group mb-1 flex gap-1">
                      <div className={`w-full ${tone}`}>
                        <InlineField
                          doc={asFieldDoc(item)}
                          entries={fieldLinkTargets}
                          placeholder="— ('[[' links an entry)"
                          onChange={(d) => {
                            const next = [...items];
                            next[idx] = d;
                            setFields({ ...fields, [name]: next });
                            bump();
                          }}
                        />
                      </div>
                      <Button
                        icon
                        intent="danger"
                        tip="Remove item"
                        className="border-transparent opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                        onClick={() =>
                          setFields({
                            ...fields,
                            [name]: items.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        ×
                      </Button>
                    </div>
                  ))}
                  <Button
                    className="btn-add"
                    onClick={() =>
                      setFields({ ...fields, [name]: [...items, strToDoc("")] })
                    }
                  >
                    + add
                  </Button>
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
                      bump();
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
                  bump();
                }}
                placeholder="—"
                className={`h-7 min-w-0 flex-1 rounded bg-transparent px-1 outline-none placeholder:text-neutral-700 hover:bg-neutral-900 focus:bg-neutral-900 ${tone}`}
              />
            </label>
          );
        })}
      </div>
  );
}
