# Conventions

> Living document. Seeded before code exists; tighten it as real patterns
> emerge, in the same commits that establish them.

## Go

- Standard library first. Router: `net/http` ServeMux (1.22+ patterns).
  Add dependencies reluctantly; each new one should be defensible in review.
- Postgres via `pgx` + `sqlc` — typed queries, no ORM. Migrations are
  plain SQL files under `internal/store/migrations`, run with a migration
  tool at startup.
- Errors: wrap with `fmt.Errorf("doing x: %w", err)`; sentinel errors in
  the package that owns the concept. Tools return structured,
  agent-legible errors (an LLM reads them and retries).
- Every tool in `internal/tools` has: a name, a JSON schema for params, a
  doc comment that doubles as its MCP description, and a test.
- IDs: UUIDv7 (time-ordered). JSON: `snake_case` keys.
- Tests: table-driven, `_test.go` beside the code. Integration tests hit a
  real Postgres (dockertest or a test database), not mocks of the store.

## TypeScript / React (`web/`)

- Strict TypeScript. Types for API payloads are generated from the Go
  side (or a shared JSON-schema step) — never hand-duplicated.
- TanStack Router for routes, TanStack Query for all server state; no
  client state library until proven necessary. Server state lives in
  Query's cache, UI state in components.
- Components: function components, colocated files
  (`EntryPage.tsx`, `EntryPage.test.tsx`). Editor built on TipTap
  (ProseMirror) with a custom `draft` mark.
- Styling: pick once (Tailwind), don't mix systems.

## Naming

Use `docs/DOMAIN.md` vocabulary everywhere: an edge is an "edge" in SQL,
Go, TS, and UI copy alike. No synonyms (no "link"/"connection"/"ref" for
the same concept).

## Commits

- One task per commit series; reference the bead id: `feat: edge storage
  and reverse sections (lore-xxxxxx)`.
- Docs and ADRs that a change implies ship in the same commit.
- End commit messages with:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
