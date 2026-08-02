import { useState } from "react";
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  useNavigate,
} from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { CommandPalette } from "./palette";
import { Button, Tooltip } from "./ui";
import { SchemaPage, SettingsPage, WorldPage } from "./world-page";
import { TypeListPage } from "./type-list";
import { EntryPage } from "./entry-page";

const rootRoute = createRootRoute({
  component: () => (
    <Tooltip.Provider delay={400}>
      <div className="min-h-screen bg-stone-950 text-white">
        <main>
          <Outlet />
        </main>
        <CommandPalette />
      </div>
    </Tooltip.Provider>
  ),
});

// ---------- Worlds index ----------

function WorldsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const worlds = useQuery({ queryKey: ["worlds"], queryFn: api.listWorlds });
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => api.createWorld(name.trim()),
    onSuccess: (w) => {
      qc.invalidateQueries({ queryKey: ["worlds"] });
      navigate({ to: "/w/$worldId", params: { worldId: w.id } });
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h2 className="">Your worlds</h2>
      <ul className="space-y-2">
        {worlds.data?.map((w) => (
          <li key={w.id}>
            <Link
              to="/w/$worldId"
              params={{ worldId: w.id }}
              className="block rounded border border-stone-800 bg-stone-900 px-3 py-2 hover:border-stone-600"
            >
              {w.name}
            </Link>
          </li>
        ))}
        {worlds.data?.length === 0 && (
          <li className="text-stone-500">No worlds yet — create one.</li>
        )}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New world name"
          className="input flex-1"
        />
        <Button intent="solid" type="submit" disabled={create.isPending}>
          Create
        </Button>
      </form>
    </div>
  );
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: WorldsPage,
});

const worldRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/w/$worldId",
  component: function WorldRoute() {
    const { worldId } = worldRoute.useParams();
    return <WorldPage key={worldId} worldId={worldId} />;
  },
});

const entryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/e/$entryId",
  // Key by entryId: navigating entry→entry must remount, or a pending
  // debounced autosave from the old entry writes onto the new one.
  component: function EntryRoute() {
    const { entryId } = entryRoute.useParams();
    return <EntryPage key={entryId} entryId={entryId} />;
  },
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/w/$worldId/settings",
  component: function SettingsRoute() {
    const { worldId } = settingsRoute.useParams();
    return <SettingsPage key={worldId} worldId={worldId} />;
  },
});

const schemaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/w/$worldId/schema",
  component: function SchemaRoute() {
    const { worldId } = schemaRoute.useParams();
    return <SchemaPage key={worldId} worldId={worldId} />;
  },
});

const typeListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/w/$worldId/t/$typeId",
  component: function TypeListRoute() {
    const { worldId, typeId } = typeListRoute.useParams();
    return <TypeListPage key={typeId} worldId={worldId} typeId={typeId} />;
  },
});

export const routeTree = rootRoute.addChildren([
  settingsRoute,
  schemaRoute,
  typeListRoute,
  indexRoute,
  worldRoute,
  entryRoute,
]);
