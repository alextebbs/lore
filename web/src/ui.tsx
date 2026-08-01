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
