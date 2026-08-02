import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { appState } from "./app-state";
import { RowButton } from "./ui";
import { useDebounced } from "./use-debounced";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

// ⌘K command palette. Pages register their visible controls with
// usePageCommands; the palette snapshots the registry when it opens, so
// every action on the current page is reachable from the keyboard,
// alongside jump-to-entry for the current world.

export type Command = {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
};

export function usePageCommands(
  worldId: string | undefined,
  commands: Command[],
) {
  useEffect(() => {
    appState.commands = { worldId, list: commands };
    return () => {
      appState.commands = { worldId: undefined, list: [] };
    };
  });
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const [snap, setSnap] = useState<{ worldId?: string; commands: Command[] }>({
    commands: [],
  });
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const openIt = () => {
      setSnap({
        worldId: appState.commands.worldId,
        commands: appState.commands.list,
      });
      setQuery("");
      setSel(0);
      setOpen(true);
    };
    appState.openPalette = openIt;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openIt();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      appState.openPalette = () => {};
    };
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const entries = useQuery({
    queryKey: ["entries", snap.worldId],
    queryFn: () => api.listEntries(snap.worldId!),
    enabled: open && !!snap.worldId,
  });
  // Entry rows come from FindRelevant when there's a query — hybrid
  // ranking over bodies and fields, not title substrings.
  const dq = useDebounced(query.trim(), 200);
  const searched = useQuery({
    queryKey: ["search", snap.worldId, dq],
    queryFn: () => api.search(snap.worldId!, dq),
    enabled: open && !!snap.worldId && dq !== "",
    placeholderData: (prev) => prev,
  });

  const q = query.trim().toLowerCase();
  const rows = [
    ...snap.commands
      .filter((c) => !q || c.label.toLowerCase().includes(q))
      .map((c) => ({
        id: "a:" + c.id,
        label: c.label,
        hint: c.hint ?? "action",
        run: c.run,
      })),
    ...(q ? (searched.data ?? []) : (entries.data ?? []))
      .slice(0, 10)
      .map((e) => ({
        id: "e:" + e.id,
        label: e.title,
        hint: e.type_name,
        run: () => navigate({ to: "/e/$entryId", params: { entryId: e.id } }),
      })),
  ];
  const selIdx = Math.min(sel, Math.max(rows.length - 1, 0));
  const pick = (row: (typeof rows)[number]) => {
    setOpen(false);
    row.run();
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="anim-backdrop fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup
          className="anim-fade panel fixed left-1/2 top-[15vh] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden outline-none"
          aria-label="Command palette"
        >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => (s + 1) % Math.max(rows.length, 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel(
                (s) =>
                  (s - 1 + Math.max(rows.length, 1)) % Math.max(rows.length, 1),
              );
            }
            if (e.key === "Enter" && rows[selIdx]) pick(rows[selIdx]);
          }}
          placeholder="Search entries and actions…"
          className="w-full border-b border-stone-800 bg-transparent px-4 py-3 outline-none placeholder:text-stone-600"
        />
        <div className="max-h-80 overflow-y-auto py-1">
          {rows.length === 0 && (
            <div className="px-4 py-3 text-stone-600">
              no matches
            </div>
          )}
          {rows.map((row, i) => (
            <RowButton
              key={row.id}
              active={i === selIdx}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(row)}
              onMouseEnter={() => setSel(i)}
            >
              <span className="truncate">{row.label}</span>
              <span className="shrink-0 text-stone-600">{row.hint}</span>
            </RowButton>
          ))}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
