# ADR 0005: One tool layer; capabilities exposed, orchestration not

Status: accepted (2026-07-27)

## Context

Tenet 2 requires everything to be doable via MCP. Two consumers exist: the
in-app agent loop and external MCP clients (Claude Code/Desktop — shipping
day one). Parallel surfaces drift; routing the in-app agent through its own
MCP endpoint adds indirection.

## Decision

A single tool registry in Go (`internal/tools`). The in-app agent loop
executes tools directly; the MCP server exposes the same registry to
external clients authenticated by per-user API tokens. The corollary:
**capabilities are exposed; orchestration is not.** The in-app harness
(auto-retrieval, tray injection) may only compose public tools — there is
no private API that outperforms what an MCP client can reach. Auto
behaviors that require owning the loop are offered to external clients as
explicit calls, an MCP resource (context tray), and an MCP prompt
(`load-world-context`).

## Consequences

- Parity by construction; `docs/TOOLS.md` is simultaneously API spec,
  agent capability list, and MCP docs.
- External clients pay one tool-call round-trip for what the harness
  pre-loads — accepted as structural, not a tenet violation.
- Draft/canon enforcement lives in the tool layer, once.
