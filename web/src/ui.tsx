// Shared UI atoms and doc helpers.
import type { DocNode } from "./doc";

// Fields-as-docs: richtext values are docs; legacy strings wrap into a
// minimal doc until their next save migrates them server-side.
export const strToDoc = (s: string): DocNode => ({
  type: "doc",
  content: (s ? s.split("\n") : [""]).map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line }] : undefined,
  })),
});
export const asFieldDoc = (v: unknown): DocNode =>
  v && typeof v === "object" && (v as DocNode).type === "doc"
    ? (v as DocNode)
    : strToDoc(typeof v === "string" ? v : "");

export const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function StatusBadge({ status }: { status: string }) {
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

// Content-area skeleton: same layout bones as the entry page, so a
// cold-load navigation swaps content without moving anything else.
export function EntrySkeleton() {
  const bar = (w: string) => (
    <div className={`h-4 animate-pulse rounded bg-neutral-900 ${w}`} />
  );
  return (
    <div className="max-w-4xl space-y-5 p-6" aria-busy="true">
      <div className="h-7 w-64 animate-pulse rounded bg-neutral-900" />
      <div className="space-y-3 pt-2">
        {["w-3/4", "w-1/2", "w-2/3", "w-1/3"].map((w) => (
          <div key={w} className="flex gap-3">
            <div className="w-44 shrink-0" />
            {bar(w)}
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-4">
        {bar("w-full")}
        {bar("w-full")}
        {bar("w-5/6")}
        {bar("w-2/3")}
      </div>
    </div>
  );
}
