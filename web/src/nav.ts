// Router indirection: modules outside the route tree (the editor's
// mention chips) navigate through this ref; main.tsx points it at the
// real router once it exists. The fallback is a full page load.
export const nav: { toEntry: (id: string) => void } = {
  toEntry: (id) => window.location.assign(`/e/${id}`),
};
