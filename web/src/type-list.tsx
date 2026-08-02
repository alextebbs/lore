import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { api, type EntryRow, type FieldValue } from "./api";
import { RowButton, StatusBadge, titleCase } from "./ui";
import { WorldSidebar } from "./sidebar";

// Per-type listing: a real table (Base UI ships behavior, not tables —
// ScrollArea wraps semantic HTML). One column per non-relation field
// of the type, plus title and status; client-side search and sort.

const cellText = (fv: FieldValue | undefined): string => {
  if (!fv) return "";
  const v = fv.value;
  const s = Array.isArray(v) ? v.map(String).join("; ") : String(v ?? "");
  return s.replace(/\[\[([^[\]]+)\]\]/g, "$1");
};

export function TypeListPage({
  worldId,
  typeId,
}: {
  worldId: string;
  typeId: string;
}) {
  const world = useQuery({
    queryKey: ["world", worldId],
    queryFn: () => api.getWorld(worldId),
  });
  const rows = useQuery({
    queryKey: ["entries-full", worldId, typeId],
    queryFn: () => api.listEntriesFull(worldId, typeId),
  });
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<string>("title");
  const [asc, setAsc] = useState(true);

  const type = world.data?.types.find((t) => t.id === typeId);
  const columns = useMemo(
    () =>
      (type?.fields ?? [])
        .filter((f) => f.kind !== "relation")
        .map((f) => f.name),
    [type],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows.data ?? [];
    if (needle) {
      list = list.filter((r) =>
        [r.title, ...columns.map((c) => cellText(r.fields?.[c]))]
          .join("\n")
          .toLowerCase()
          .includes(needle),
      );
    }
    const val = (r: EntryRow) =>
      sortBy === "title"
        ? r.title
        : sortBy === "status"
          ? r.status
          : cellText(r.fields?.[sortBy]);
    return [...list].sort((a, b) => {
      const cmp = val(a).localeCompare(val(b), undefined, { numeric: true });
      return asc ? cmp : -cmp;
    });
  }, [rows.data, q, sortBy, asc, columns]);

  const header = (key: string, label: string) => (
    <th key={key} className="p-0 text-left">
      <RowButton
        onClick={() => {
          if (sortBy === key) setAsc(!asc);
          else {
            setSortBy(key);
            setAsc(true);
          }
        }}
        className="!justify-start gap-1 text-stone-500 hover:text-white"
      >
        {label}
        {sortBy === key &&
          (asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </RowButton>
    </th>
  );

  return (
    <div>
      <WorldSidebar worldId={worldId} />
      <div
        style={{ marginLeft: "var(--sidebar-w)" }}
        className="flex h-screen flex-col space-y-4 p-6"
      >
        <div className="flex shrink-0 items-center gap-3">
          <h2 className="display-lg display">{titleCase(type?.name ?? "…")}</h2>
          <span className="text-stone-600">
            {filtered.length} of {rows.data?.length ?? 0}
          </span>
          <span className="flex-1" />
          <label className="input flex w-64 items-center gap-1.5 text-stone-600 focus-within:bg-stone-800">
            <Search size={13} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter…"
              className="w-full bg-transparent text-white outline-none placeholder:text-stone-600"
            />
          </label>
        </div>

        <ScrollArea.Root className="min-h-0 flex-1">
          <ScrollArea.Viewport className="h-full overscroll-contain rounded border border-stone-800">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-stone-950">
                <tr className="border-b border-stone-800">
                  {header("title", "Title")}
                  {columns.map((c) => header(c, titleCase(c)))}
                  {header("status", "Status")}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-stone-900 hover:bg-stone-900/60"
                  >
                    <td className="max-w-64 truncate px-3 py-1.5">
                      <Link
                        to="/e/$entryId"
                        params={{ entryId: r.id }}
                        className="entity"
                      >
                        {r.title}
                      </Link>
                    </td>
                    {columns.map((c) => (
                      <td
                        key={c}
                        className="max-w-80 truncate px-3 py-1.5 text-stone-400"
                        title={cellText(r.fields?.[c])}
                      >
                        {cellText(r.fields?.[c])}
                      </td>
                    ))}
                    <td className="px-3 py-1.5">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns.length + 2}
                      className="px-3 py-6 text-center text-stone-600"
                    >
                      no matches
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar
            orientation="vertical"
            className="flex w-1.5 justify-center bg-transparent"
          >
            <ScrollArea.Thumb className="w-full rounded bg-stone-700" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </div>
    </div>
  );
}
