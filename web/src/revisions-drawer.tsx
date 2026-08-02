import { useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { useMutation, useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import {
  api,
  type Entry,
  type FieldValue,
  type Revision,
} from "./api";
import { diffWords } from "./diff";
import { Button, RowButton, StatusBadge, age, titleCase } from "./ui";

// Revision history in a right-side drawer: the list of snapshots on
// the left, and a diff of the selected snapshot against the current
// entry on the right — rendered in the entry page's own layout (label
// rail + value column) and covering title, every field by name, and
// the body. Relations live in edges, which aren't versioned, so they
// don't appear here.

// Diff is plain text: draft markers vanish, mention syntax renders as
// the bare title (chips can't survive word-level diffing).
const displayText = (s: string) =>
  s.replace(/\{~draft\}|\{\/~\}/g, "").replace(/\[\[([^\[\]]+)\]\]/g, "$1");

function fieldText(fv: FieldValue | undefined): string {
  if (!fv) return "";
  const v = fv.value;
  if (Array.isArray(v)) return displayText(v.map(String).join("\n"));
  return displayText(String(v ?? ""));
}

function DiffText({ from, to }: { from: string; to: string }) {
  if (from === to)
    return <span className="whitespace-pre-wrap">{to || "—"}</span>;
  return (
    <span className="whitespace-pre-wrap">
      {diffWords(to, from).map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "add" ? (
          <span key={i} className="rounded bg-emerald-950 text-emerald-300">
            {p.text}
          </span>
        ) : (
          <span key={i} className="rounded bg-red-950 text-red-400 line-through">
            {p.text}
          </span>
        ),
      )}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-32 shrink-0 text-right leading-7 text-stone-500">
        {label}
      </div>
      <div className="min-w-0 flex-1 py-[2.8px]">{children}</div>
    </div>
  );
}



export function RevisionsDrawer({
  entry,
  revisions,
  open,
  onOpenChange,
  onRestored,
}: {
  entry: Entry;
  revisions: Revision[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestored: (e: Entry) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedId = selected ?? revisions[0]?.id ?? null;

  const detail = useQuery({
    queryKey: ["revision", entry.id, selectedId],
    queryFn: () => api.getRevision(entry.id, selectedId!),
    enabled: open && !!selectedId,
  });

  const restore = useMutation({
    mutationFn: () => api.restoreRevision(entry.id, selectedId!),
    onSuccess: (e) => {
      onRestored(e);
      onOpenChange(false);
    },
  });

  const rev = detail.data;
  // Diff rows: title, then the union of field names (current ∪ revision,
  // schema order first via current entry's key order), then body.
  const fieldNames = rev
    ? [
        ...Object.keys(entry.fields),
        ...Object.keys(rev.fields).filter((n) => !(n in entry.fields)),
      ]
    : [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="anim-backdrop fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="anim-slide-right fixed bottom-0 right-0 top-0 z-40 flex w-[52rem] max-w-[95vw] flex-col border-l border-stone-800 bg-stone-950 shadow-2xl outline-none">
          <div className="flex items-center justify-between border-b border-stone-800 px-4 py-2">
            <Dialog.Title className="">
              Revisions — {entry.title}
            </Dialog.Title>
            <Dialog.Close
              render={
                <Button icon tip="Close" className="border-transparent">
                  <X size={13} />
                </Button>
              }
            />
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="w-48 shrink-0 overflow-y-auto border-r border-stone-800 py-1">
              {revisions.map((r) => (
                <RowButton
                  key={r.id}
                  active={r.id === selectedId}
                  className="flex-col !items-start gap-0 px-3"
                  onClick={() => setSelected(r.id)}
                >
                  <span>{age(r.created_at)}</span>
                  <span className="text-stone-600">
                    {r.author} · {r.status}
                  </span>
                </RowButton>
              ))}
              {revisions.length === 0 && (
                <div className="px-3 py-2 text-stone-600">no revisions</div>
              )}
            </div>
            <div className="min-w-0 flex-1 overflow-y-auto p-4">
              {rev ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">
                      current vs. {age(rev.created_at)} ({rev.author})
                    </span>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={rev.status} />
                      <Button intent="solid" onClick={() => restore.mutate()}>
                        restore this version
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Row label="Title">
                      <DiffText from={rev.title} to={entry.title} />
                    </Row>
                    {fieldNames.map((name) => {
                      const cur = fieldText(entry.fields[name]);
                      const old = fieldText(rev.fields[name]);
                      if (!cur && !old) return null;
                      return (
                        <Row key={name} label={titleCase(name)}>
                          <DiffText from={old} to={cur} />
                        </Row>
                      );
                    })}
                    <Row label="Body">
                      <DiffText
                        from={displayText(rev.body_md)}
                        to={displayText(entry.body_md)}
                      />
                    </Row>
                  </div>
                  <p className="text-stone-600">
                    Additions since this revision are green; text this
                    revision had that's now gone is red. Relations aren't
                    versioned and don't appear here.
                  </p>
                </div>
              ) : (
                <div className="text-stone-600">
                  {selectedId ? "loading…" : "select a revision"}
                </div>
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
