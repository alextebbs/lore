import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routes";
import { appState, initSidebarWidth } from "./app-state";
import "./index.css";

const queryClient = new QueryClient();
const router = createRouter({ routeTree });
initSidebarWidth();
// Mention chips (and anything outside the route tree) navigate through
// appState — SPA navigation instead of a full page load.
appState.navToEntry = (id) =>
  router.navigate({ to: "/e/$entryId", params: { entryId: id } });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
