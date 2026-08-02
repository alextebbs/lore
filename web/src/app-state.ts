// The app's deliberate module-level state, in one place. Everything
// here survives route remounts on purpose; nothing else in the
// frontend may declare module-scoped mutable state (design test).

import type { Command } from "./palette";

export const appState = {
  // Last world whose sidebar was shown — keeps the frame mounted while
  // the next entry loads.
  lastWorldId: "",
  // Sidebar scroll position per world (route remounts reset DOM).
  sidebarScroll: {} as Record<string, number>,
  // ⌘K page-command registry; pages write, the palette snapshots.
  commands: { worldId: undefined as string | undefined, list: [] as Command[] },
  // Router indirection for modules outside the route tree (editor
  // mention chips). main.tsx points this at the real router.
  navToEntry: (id: string) => window.location.assign(`/e/${id}`),
  // Openers wired by the components that own the UI (palette, sidebar
  // new-entry dialog) so buttons elsewhere can trigger them.
  openPalette: () => {},
  openNewEntry: () => {},
};

// Sidebar width lives in a CSS variable so the fixed nav and content
// margin move together while dragging; persisted per user.
const SIDEBAR_WIDTH_KEY = "lore:sidebar-width";
export function initSidebarWidth() {
  document.documentElement.style.setProperty(
    "--sidebar-w",
    `${Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || 240}px`,
  );
}
export function setSidebarWidth(px: number) {
  const w = Math.min(480, Math.max(180, px));
  document.documentElement.style.setProperty("--sidebar-w", `${w}px`);
  localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
}
export function sidebarWidth(): number {
  return Number(localStorage.getItem(SIDEBAR_WIDTH_KEY)) || 240;
}

// Chat context: which world/entry the assistant should attach to.
// Reactive (unlike the rest of appState) because the root-mounted
// ChatDock must re-render on navigation.
import { useSyncExternalStore } from "react";

let chatCtx: { worldId: string; entryId?: string } = { worldId: "" };
const chatSubs = new Set<() => void>();

export function setChatContext(worldId: string, entryId?: string) {
  if (chatCtx.worldId === worldId && chatCtx.entryId === entryId) return;
  chatCtx = { worldId, entryId };
  chatSubs.forEach((fn) => fn());
}

export function useChatContext() {
  return useSyncExternalStore(
    (cb) => {
      chatSubs.add(cb);
      return () => chatSubs.delete(cb);
    },
    () => chatCtx,
  );
}
