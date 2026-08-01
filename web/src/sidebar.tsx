import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Home } from "lucide-react";
import { api, type EntrySummary } from "./api";

// ---------- World sidebar (Notion-style) ----------

// Sidebar scroll survives route remounts (module-scoped, per world).
const sidebarScroll: Record<string, number> = {};

// Sidebar width lives in a CSS variable so the fixed nav and the
// content margin stay in lockstep while dragging; persisted per user.
const SIDEBAR_WIDTH_KEY = "lore:sidebar-width";
document.documentElement.style.setProperty(
  "--sidebar-w",
  `${Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || 240}px`,
);

function startSidebarResize(e: React.MouseEvent) {
  e.preventDefault();
  const move = (ev: MouseEvent) => {
    const w = Math.min(480, Math.max(180, ev.clientX));
    document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
  };
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    document.body.style.cursor = "";
  };
  document.body.style.cursor = "col-resize";
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

export function WorldSidebar({
  worldId,
  currentEntryId,
}: {
  worldId: string;
  currentEntryId?: string;
}) {
  const navRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (navRef.current) navRef.current.scrollTop = sidebarScroll[worldId] ?? 0;
  }, [worldId]);
  const qc = useQueryClient();
  const entries = useQuery({
    queryKey: ["entries", worldId],
    queryFn: () => api.listEntries(worldId),
  });
  // Hover-prefetch: by the time a link is clicked its entry is usually
  // cached, so navigation renders instantly instead of skeletoning.
  const prefetch = (id: string) =>
    qc.prefetchQuery({
      queryKey: ["entry", id],
      queryFn: () => api.getEntry(id),
      staleTime: 15_000,
    });
  // Filter-as-you-type narrows the list in place; without a query,
  // groups cap at GROUP_CAP with a per-group "show all" toggle
  // (Slack-style) so the unfiltered sidebar stays scannable.
  const GROUP_CAP = 8;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const q = query.trim().toLowerCase();
  const grouped = new Map<string, EntrySummary[]>();
  for (const e of entries.data ?? []) {
    // The World meta entry is the home link above — one per world,
    // never listed as a group.
    if (e.type_name === "World") continue;
    if (q && !e.title.toLowerCase().includes(q)) continue;
    grouped.set(e.type_name, [...(grouped.get(e.type_name) ?? []), e]);
  }
  const typeNames = [...grouped.keys()].sort((a, b) =>
    a === "World" ? -1 : b === "World" ? 1 : a.localeCompare(b),
  );
  return (
    <nav
      ref={navRef}
      onScroll={(e) => {
        sidebarScroll[worldId] = e.currentTarget.scrollTop;
      }}
      style={{ width: "var(--sidebar-w)" }}
      className="fixed inset-y-0 left-0 overflow-y-auto border-r border-neutral-800 bg-neutral-950 px-3 py-4 text-sm"
    >
      <div
        onMouseDown={startSidebarResize}
        onKeyDown={(e) => {
          const cur =
            Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || 240;
          const next =
            e.key === "ArrowLeft" ? cur - 16 : e.key === "ArrowRight" ? cur + 16 : cur;
          if (next !== cur) {
            const w = Math.min(480, Math.max(180, next));
            document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
            localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
            e.preventDefault();
          }
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar (drag or arrow keys)"
        tabIndex={0}
        title="Drag to resize"
        className="fixed inset-y-0 z-30 w-1.5 cursor-col-resize hover:bg-neutral-700 focus:bg-neutral-600 focus:outline-none"
        style={{ left: "calc(var(--sidebar-w) - 3px)" }}
      />
      <Link
        to="/"
        className="mb-4 block text-lg font-semibold tracking-wide text-white hover:text-white"
      >
        Lore
      </Link>
      {(() => {
        // The world's own page IS its meta entry — no separate listing.
        const meta = (entries.data ?? []).find((e) => e.type_name === "World");
        return meta ? (
          <Link
            to="/e/$entryId"
            params={{ entryId: meta.id }}
            className={`mb-3 flex items-center gap-1.5 rounded px-2 py-0.5 font-semibold ${
              meta.id === currentEntryId
                ? "bg-neutral-800 text-white"
                : "text-white hover:text-white"
            }`}
          >
            <Home size={14} /> {meta.title}
          </Link>
        ) : null;
      })()}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setQuery("");
        }}
        placeholder="search…"
        className="input mb-3 w-full"
      />
      {q && typeNames.length === 0 && (
        <div className="text-neutral-600">no matches</div>
      )}
      {typeNames.map((typeName) => {
        const all = grouped.get(typeName)!;
        const open = q !== "" || expanded[typeName];
        const shown = open ? all : all.slice(0, GROUP_CAP);
        return (
          <div key={typeName} className="mb-3">
            <div className="mb-1 text-xs text-neutral-600">
              {typeName}
            </div>
            <ul>
              {shown.map((e) => (
                <li key={e.id}>
                  <Link
                    to="/e/$entryId"
                    params={{ entryId: e.id }}
                    onMouseEnter={() => prefetch(e.id)}
                    className={`block truncate rounded px-2 py-0.5 ${
                      e.id === currentEntryId
                        ? "bg-neutral-800 text-white"
                        : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                    }`}
                    title={e.title}
                  >
                    {e.title}
                    {e.status !== "canon" && (
                      <span className="ml-1 text-neutral-600">•</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
            {!q && all.length > GROUP_CAP && (
              <button
                type="button"
                onClick={() =>
                  setExpanded({ ...expanded, [typeName]: !expanded[typeName] })
                }
                className="mt-0.5 inline-flex items-center gap-1 px-2 text-xs text-neutral-600 hover:text-neutral-300"
              >
                {expanded[typeName] ? (
                  "show less"
                ) : (
                  <>
                    show all {all.length} <ChevronRight size={12} />
                  </>
                )}
              </button>
            )}
          </div>
        );
      })}
    </nav>
  );
}