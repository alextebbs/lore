# 0016 — One tool registry declares the whole surface

Status: proposed
Date: 2026-08-01
Amends: 0005 (one tool layer)

## Context

Tenet 2 (every capability on API + MCP + UI) was enforced by
discipline across four hand-maintained copies: HTTP handlers, MCP
registrations, the TS client, and the TOOLS.md parity table. ~30
capabilities × 4 places; drift was inevitable — the first parity test
run caught five client methods that had silently never existed.

## Decision

`internal/toolreg` holds one row per capability: tool-layer entry
point, HTTP method+path, MCP tool name, TS client method, and a note.
Deliberate absences (the UI-only chat harness) are explicit empty
columns, never omissions.

Enforcement, strongest available per surface:
- **HTTP:** the mux is *wired by iterating the registry*; a row
  without a handler panics at startup.
- **MCP:** registrations are recorded and compared to the registry in
  `New()`; any mismatch panics at startup.
- **TS client:** a Go test greps `web/src/api.ts` for every declared
  method.
- **Docs:** `cmd/gentools` (make tools-docs) generates the TOOLS.md
  capability table; a test fails when it's stale.

## Consequences

Adding a capability is: implement in `internal/tools`, add one
registry row, and the build/startup/tests refuse to proceed until
every adapter exists. Handler bodies stay hand-written and typed —
the registry governs *presence*, not serialization. Full codegen of
adapters remains possible later; presence-enforcement removes the
drift risk that motivated this ADR.
