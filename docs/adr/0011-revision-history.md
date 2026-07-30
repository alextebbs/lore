# ADR 0011: Append-only revision snapshots

Status: accepted (2026-07-27)

## Context

"AI has full power over drafts" (ADR 0002) is only safe if changes are
recoverable and auditable. Full branching/blame was considered, as was
shipping without history.

## Decision

Append-only revision snapshot on every entry write, recording the author
(human vs AI). UI: a simple diff viewer and "restore this revision". No
branching. Revisions also drive cache invalidation for cards, digests, and
embeddings (ADR 0010).

## Consequences

- Trust story: every AI change is inspectable and reversible.
- Storage grows with edit volume; snapshots are cheap JSONB rows, compact
  later if needed.
- No per-span blame or branching drafts in v1.
