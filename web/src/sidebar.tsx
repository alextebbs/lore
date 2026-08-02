import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@base-ui/react/dialog";
import { BookOpen, ChevronRight, Plus, Search, Settings2, Shapes } from "lucide-react";
import { api, type EntrySummary } from "./api";
import { appState, setChatContext, setSidebarWidth, sidebarWidth } from "./app-state";
import { Button, LinkButton, Picker } from "./ui";

function startSidebarResize(e: React.MouseEvent) {
  e.preventDefault();
  const move = (ev: MouseEvent) => setSidebarWidth(ev.clientX);
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    document.body.style.cursor = "";
  };
  document.body.style.cursor = "col-resize";
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

// New-entry dialog, opened from the sidebar's sticky header (and from
// anywhere via appState.openNewEntry).
function NewEntryDialog({ worldId }: { worldId: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [typeId, setTypeId] = useState("");
  const world = useQuery({
    queryKey: ["world", worldId],
    queryFn: () => api.getWorld(worldId),
  });
  useEffect(() => {
    appState.openNewEntry = () => setOpen(true);
    return () => {
      appState.openNewEntry = () => {};
    };
  }, []);
  const create = useMutation({
    mutationFn: () => api.createEntry(worldId, typeId, title.trim()),
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: ["entries", worldId] });
      setOpen(false);
      setTitle("");
      navigate({ to: "/e/$entryId", params: { entryId: e.id } });
    },
  });
  return (
    <>
      <Button className="btn-add w-full" onClick={() => setOpen(true)}>
        <Plus size={12} /> new entry
      </Button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="anim-backdrop fixed inset-0 z-50 bg-black/50" />
          <Dialog.Popup className="anim-fade panel fixed left-1/2 top-1/3 z-50 w-full max-w-sm -translate-x-1/2 p-4 outline-none">
            <Dialog.Title className="">New entry</Dialog.Title>
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (title.trim() && typeId) create.mutate();
              }}
            >
              <Picker
                value={typeId}
                onChange={setTypeId}
                placeholder="Type…"
                items={(world.data?.types ?? [])
                  .filter((t) => t.name !== "World")
                  .map((t) => ({ value: t.id, label: t.name }))}
              />
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title"
                autoFocus
                className="input w-full"
              />
              <div className="flex justify-end gap-2">
                <Dialog.Close render={<Button>cancel</Button>} />
                <Button
                  intent="solid"
                  type="submit"
                  disabled={!title.trim() || !typeId || create.isPending}
                >
                  create
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

export function WorldSidebar({
  worldId,
  currentEntryId,
}: {
  worldId: string;
  currentEntryId?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setChatContext(worldId, currentEntryId);
  }, [worldId, currentEntryId]);
  useLayoutEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = appState.sidebarScroll[worldId] ?? 0;
  }, [worldId]);
  const world = useQuery({
    queryKey: ["world", worldId],
    queryFn: () => api.getWorld(worldId),
  });
  const entries = useQuery({
    queryKey: ["entries", worldId],
    queryFn: () => api.listEntries(worldId),
  });
  const qc = useQueryClient();
  const prefetch = (id: string) =>
    qc.prefetchQuery({
      queryKey: ["entry", id],
      queryFn: () => api.getEntry(id),
      staleTime: 15_000,
    });

  const GROUP_CAP = 8;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const meta = (entries.data ?? []).find((e) => e.type_name === "World");

  const grouped = new Map<string, EntrySummary[]>();
  for (const e of entries.data ?? []) {
    if (e.type_name === "World") continue;
    grouped.set(e.type_name, [...(grouped.get(e.type_name) ?? []), e]);
  }
  const typeNames = [...grouped.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <nav
      style={{ width: "var(--sidebar-w)" }}
      className="fixed inset-y-0 left-0 flex flex-col border-r border-stone-800 bg-stone-950"
    >
      <div
        onMouseDown={startSidebarResize}
        onKeyDown={(e) => {
          const cur = sidebarWidth();
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            setSidebarWidth(cur + (e.key === "ArrowLeft" ? -16 : 16));
            e.preventDefault();
          }
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar (drag or arrow keys)"
        tabIndex={0}
        className="fixed inset-y-0 z-30 w-1.5 cursor-col-resize hover:bg-stone-700 focus:bg-stone-600 focus:outline-none"
        style={{ left: "calc(var(--sidebar-w) - 3px)" }}
      />

      {/* Sticky header: brand, world row, search, new entry. */}
      <div className="shrink-0 space-y-3 border-b border-stone-800 px-3 py-4">
        <Link to="/" className="display block text-white hover:text-white">
          Lore
        </Link>
        <div className="flex items-center gap-1">
          <span
            className="min-w-0 flex-1 truncate"
            title={world.data?.world.name}
          >
            {world.data?.world.name ?? "…"}
          </span>
          {meta && (
            <Button
              icon
              tip="World entry"
              className="border-transparent"
              active={meta.id === currentEntryId}
              onClick={() => appState.navToEntry(meta.id)}
            >
              <BookOpen size={13} />
            </Button>
          )}
          <LinkButton
            icon
            tip="World settings & export"
            className="border-transparent"
            href={`/w/${worldId}/settings`}
          >
            <Settings2 size={13} />
          </LinkButton>
          <LinkButton
            icon
            tip="Entry types"
            className="border-transparent"
            href={`/w/${worldId}/schema`}
          >
            <Shapes size={13} />
          </LinkButton>
        </div>
        <Button
          className="input w-full border-0 text-stone-600 hover:bg-stone-800 hover:text-stone-400"
          onClick={() => appState.openPalette()}
        >
          <Search size={13} />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-stone-800 px-1 text-stone-600">
            ⌘K
          </kbd>
        </Button>
        <NewEntryDialog worldId={worldId} />
      </div>

      {/* Scrollable entry list. */}
      <div
        ref={listRef}
        onScroll={(e) => {
          appState.sidebarScroll[worldId] = e.currentTarget.scrollTop;
        }}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3"
      >
        {typeNames.map((typeName) => {
          const all = grouped.get(typeName)!;
          const open = expanded[typeName];
          const shown = open ? all : all.slice(0, GROUP_CAP);
          return (
            <div key={typeName} className="mb-3">
              <Link
                to="/w/$worldId/t/$typeId"
                params={{ worldId, typeId: all[0].type_id }}
                className="mb-1 block text-stone-600 hover:text-white"
              >
                {typeName}
              </Link>
              <ul>
                {shown.map((e) => (
                  <li key={e.id}>
                    <Link
                      to="/e/$entryId"
                      params={{ entryId: e.id }}
                      onMouseEnter={() => prefetch(e.id)}
                      className={`block truncate rounded px-2 py-0.5 hover:bg-stone-900 ${
                        e.id === currentEntryId
                          ? "bg-stone-800 text-white"
                          : e.status === "canon"
                            ? "text-stone-400 hover:text-white"
                            : "text-stone-600 hover:text-stone-400"
                      }`}
                      title={e.title}
                    >
                      {e.title}
                    </Link>
                  </li>
                ))}
              </ul>
              {all.length > GROUP_CAP && (
                <Button
                  className="mt-0.5 border-transparent text-stone-600"
                  onClick={() => setExpanded({ ...expanded, [typeName]: !open })}
                >
                  {open ? (
                    "show less"
                  ) : (
                    <>
                      show all {all.length} <ChevronRight size={12} />
                    </>
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
