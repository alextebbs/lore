import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
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

const registry: { worldId?: string; commands: Command[] } = { commands: [] };

export function usePageCommands(
  worldId: string | undefined,
  commands: Command[],
) {
  useEffect(() => {
    registry.worldId = worldId;
    registry.commands = commands;
    return () => {
      registry.worldId = undefined;
      registry.commands = [];
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
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSnap({ worldId: registry.worldId, commands: registry.commands });
        setQuery("");
        setSel(0);
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const entries = useQuery({
    queryKey: ["entries", snap.worldId],
    queryFn: () => api.listEntries(snap.worldId!),
    enabled: open && !!snap.worldId,
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
    ...(entries.data ?? [])
      .filter((e) => !q || e.title.toLowerCase().includes(q))
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
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup
          className="panel fixed left-1/2 top-[15vh] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden outline-none"
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
          className="w-full border-b border-neutral-800 bg-transparent px-4 py-3 text-sm outline-none placeholder:text-neutral-600"
        />
        <div className="max-h-80 overflow-y-auto py-1">
          {rows.length === 0 && (
            <div className="px-4 py-3 text-sm text-neutral-600">
              no matches
            </div>
          )}
          {rows.map((row, i) => (
            <button
              key={row.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(row)}
              onMouseEnter={() => setSel(i)}
              className={`flex w-full items-center justify-between gap-4 px-4 py-2 text-left text-sm ${
                i === selIdx ? "bg-neutral-800 text-white" : "text-neutral-300"
              }`}
            >
              <span className="truncate">{row.label}</span>
              <span className="shrink-0 text-xs text-neutral-600">
                {row.hint}
              </span>
            </button>
          ))}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
