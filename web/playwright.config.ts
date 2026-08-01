import { defineConfig } from "@playwright/test";

// Smoke suite for the core product loops. Expects the dev environment
// running: Postgres (docker), the Go API on :8080, and Vite on :5173
// (`make dev` / npm run dev). Each spec builds its own scratch world
// via the API and deletes it afterwards — Emberfall is never touched.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  workers: 1, // specs share one scratch world; keep them serial
  use: {
    baseURL: "http://localhost:5173",
  },
});
