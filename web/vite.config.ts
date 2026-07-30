import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Dev keeps the single-origin model (ADR 0009): the Go server owns /api.
      "/api": "http://localhost:8080",
    },
  },
});
