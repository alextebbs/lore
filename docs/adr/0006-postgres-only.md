# ADR 0006: Postgres is the only datastore

Status: accepted (2026-07-27)

## Context

The app has three data shapes that superficially suggest specialty stores:
soft-schema documents (→ Mongo?), a relation graph (→ Neo4j?), and
semantic retrieval (→ vector DB?). SQLite/LiteFS was the other serious
single-store candidate.

## Decision

One Postgres instance holds everything: entry fields and rich-text
documents as JSONB (GIN-indexed), edges as a plain table, revisions
append-only, lexical search via tsvector/pg_trgm, embeddings via pgvector.

Rationale: graph needs are shallow (1–2 hop ego networks, membership
queries — joins and small recursive CTEs, fine at 10–50k entries);
transactions must span entry + edges + revision atomically, which a second
store breaks; pgvector keeps semantic retrieval joinable against world_id
and canon status. Postgres over SQLite because this is a multi-tenant SaaS
with an always-on MCP endpoint and concurrent human+agent writes. Go
access via pgx + sqlc, no ORM.

## Consequences

- One backup, one deploy, atomic writes across all shapes.
- Revisit only if deep-graph analytics becomes a core feature.
- Adding any second datastore requires a new ADR.
