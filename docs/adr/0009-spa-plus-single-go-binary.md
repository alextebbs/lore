# ADR 0009: Vite SPA + single Go binary, one Fly app

Status: accepted (2026-07-27)

## Context

Frontend options within the vite/tanstack family: TanStack Start (SSR,
Node server) vs. pure client-side SPA. Deploy options: one Fly app vs.
split web/api apps.

## Decision

Pure Vite + React SPA (TanStack Router + Query) with no SSR and no Node in
production. The Go binary serves the JSON API, the MCP endpoint, the agent
loop (SSE), and the built SPA's static files. One Fly.io app + Postgres.

## Consequences

- One backend language, one deploy, one cert, no CORS.
- No SEO/SSR — irrelevant for a logged-in tool.
- Split into separate apps only if scaling demands it (would need CORS and
  a second pipeline).
