# Architecture

> Status: living document. The M0 scaffold (server, store, embedded SPA,
> CI, Dockerfile) exists; deeper packages appear as their epics land.
> Update this document in the same commit as any change that makes it
> true or false.

## Shape

One Go binary, one Postgres. The binary serves:

1. **JSON API** — consumed by the SPA (TanStack Query)
2. **MCP endpoint** — streamable HTTP, authenticated by per-user API tokens
3. **Agent loop** — server-side loop calling the Anthropic API with the
   user's BYOK key; streams to the SPA (SSE)
4. **Static files** — the built Vite SPA

```
web/            Vite + React SPA (TanStack Router + Query)
cmd/lore/       main: wiring, serving
internal/
  tools/        THE tool layer — every capability, one registry
  mcp/          MCP server adapter over tools/
  api/          HTTP handlers (thin adapters over tools/ + auth/session)
  agent/        in-app agent loop (harness): auto-retrieval, tray injection
  store/        Postgres access (pgx + sqlc), migrations
  richtext/     structured doc model, {~draft} marker ⇄ Markdown boundary
  retrieval/    hybrid scorer (semantic + lexical + graph + canon)
  derive/       card/digest generation + embedding jobs (revision-invalidated)
  export/       Obsidian vault rendering
  auth/         magic links, sessions, API tokens
```

## Load-bearing rules

- **Everything routes through `internal/tools`.** The API, the MCP server,
  the UI (via the API), and the agent loop are adapters over the same
  registry. If a capability isn't a tool, it doesn't exist (SPEC tenet 2).
  The one exception: auth and session management, which sit in front of
  the tool layer.
- **Headless-first, three first-class surfaces.** API, MCP, and UI must
  each support full interaction alone (SPEC tenet 2). A feature is not
  done when the UI works — it's done when the same capability is
  reachable via curl and via an MCP client. Surface gaps are bugs.
- **The harness is orchestration, not capability.** `internal/agent` may
  only compose public tools (pre-calling `find_relevant`, serializing the
  tray). It gets no private entry points into store/.
- **Draft/canon is enforced in the tool layer**, not in the UI and not by
  prompt. Tools that write refuse to touch canon unless the call carries
  the explicit override the user ordered.
- **Markdown at the boundary.** Postgres stores structured rich text
  (ProseMirror-style JSON). `internal/richtext` converts to/from Markdown
  with `{~draft}` markers exactly once, at the tool-layer edge.
- **One database.** Documents (JSONB), edges, revisions, FTS, embeddings
  (pgvector) all live in Postgres. No second datastore without an ADR.

## Data flow: a write

SPA or MCP client → adapter → tool (validates status rules, soft-schema
warnings) → store (entry JSONB + edge rows + revision snapshot, one
transaction) → async: derive/ regenerates card/digest/embedding for the
touched entry.

## Data flow: an agent message

User message → harness runs `find_relevant` (message + recent chat, boosted
by current page + pins) → tray assembled (pins + current page + auto items,
overflow ladder full → digest → card) → Anthropic API with tool definitions
from the registry → tool calls execute server-side → streamed to SPA with
the tray state visible.

## Deploy

One Fly.io app running the binary; Fly Postgres (or Neon) attached.
Secrets: session key, encryption key for BYOK API keys. No CORS (same
origin), no Node in production.
