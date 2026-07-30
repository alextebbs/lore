# ADR 0010: The retrieval scorer IS the search tool

Status: accepted (2026-07-28)

## Context

V1 includes auto-retrieval: on each user message the in-app harness pulls
relevant entries into context. A private retrieval subsystem beside a
public `search_entries` tool would violate the parity corollary (ADR
0005) and duplicate ranking logic.

## Decision

One hybrid scorer, exposed as `find_relevant(query, canon_only?, near?,
limit)`: semantic similarity (pgvector, when configured) + lexical match
(FTS/trigram, so exact names always win) + graph proximity to `near`
entries + canon weighting. The in-app harness calls this same tool
automatically before the model runs; external MCP clients call it
explicitly. There is no other search path.

Supporting design: every entry has three cached serializations
(card/digest/full) — AI-generated derived data outside draft/canon,
invalidated by revisions; embeddings are computed from cards. The tray
shows auto-retrieved items as labeled, evictable, promotable; overflow
degrades full → digest → card.

## Consequences

- In-app/MCP retrieval parity holds by construction.
- Scorer quality work benefits every surface at once.
- Derived-data generation (cards/digests/embeddings) is background work
  keyed off the revision log.
