import { Outlet, createRootRoute, createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-lg font-semibold tracking-wide">Lore</h1>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  ),
});

type Health = { status: string; db: string };

function Home() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: async (): Promise<Health> => {
      const res = await fetch("/api/health");
      return res.json();
    },
  });

  return (
    <div className="space-y-2">
      <p className="text-neutral-400">AI-native worldbuilding.</p>
      <p className="text-sm text-neutral-500">
        server:{" "}
        {health.isLoading
          ? "…"
          : health.isError
            ? "unreachable"
            : `${health.data!.status} (db ${health.data!.db})`}
      </p>
    </div>
  );
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Home,
});

export const routeTree = rootRoute.addChildren([indexRoute]);
