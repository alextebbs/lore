# Lore

AI-native worldbuilding for D&D and other TTRPGs. A powerful standalone
worldbuilding tool where everything is equally doable by humans, the
built-in agent, or any MCP client — and AI-authored content stays **draft**
until a human promotes it to **canon**.

Read `SPEC.md` for the full product spec, `docs/` for architecture and
conventions, and `CLAUDE.md` if you're an AI agent working here.

## Stack

One Go binary (API + MCP + agent loop + static SPA) · Postgres (pgvector) ·
Vite/React/TanStack SPA · Fly.io.

## Development

Prerequisites: Go ≥ 1.25, Node ≥ 20, Docker (any runtime; colima works).

```sh
cp .env.example .env
make dev        # terminal 1: Postgres (docker) + Go server on :8080
make dev-web    # terminal 2: Vite dev server on :5173, /api proxied to Go
```

Visit http://localhost:5173 (dev) — or run `make build && ./bin/lore` and
visit http://localhost:8080 for the production shape (SPA embedded in the
binary).

`make test` runs what CI runs. `make migrate-new name=add_worlds` creates a
migration; migrations apply automatically at server startup.

## Work tracking

Issues live in [beads](https://github.com/steveyegge/beads): `bd ready`
shows unblocked work. See `CLAUDE.md` for the workflow.

## MCP

The full tool surface is exposed at `/mcp` (streamable HTTP). Connect
Claude Code:

```sh
claude mcp add --transport http lore http://localhost:8080/mcp \
  --header "Authorization: Bearer $MCP_TOKEN"
```

`MCP_TOKEN` is optional in local dev (unset = open). AI clients author
in draft; humans promote to canon in the UI or via the API.

## In-app assistant

The chat assistant (✦ button on world/entry pages) needs
`ANTHROPIC_API_KEY` in `.env`. Optional: `VOYAGE_API_KEY` enables
semantic retrieval (embeddings); without it search runs lexical+graph.
