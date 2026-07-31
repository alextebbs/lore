# Tool-layer contract

> Status: draft sketch. This file becomes authoritative as tools land —
> every tool that exists in `internal/tools` is documented here in the
> same commit that adds or changes it. This is simultaneously the API
> spec, the agent capability list, and the MCP documentation (SPEC
> tenet 2).

Conventions: all tools are world-scoped (world resolved from auth
context + explicit `world_id`). Rich text params/results are Markdown
with `{~draft}...{/~}` markers (structured `body_doc` also accepted on
the API). Writes by AI callers always land as draft. Errors are
structured and agent-legible.

## Implemented capabilities (tool-layer function · HTTP route · MCP tool)

Per SPEC tenet 2, every row must eventually have all three columns; the
MCP column fills in when M3 lands.

| Capability | HTTP | MCP tool |
|---|---|---|
| CreateWorld | POST /api/worlds | (M3) |
| ListWorlds | GET /api/worlds | (M3) |
| GetWorld + ListTypes | GET /api/worlds/{id} | (M3) |
| ListEntries | GET /api/worlds/{id}/entries | (M3) |
| CreateEntry | POST /api/worlds/{id}/entries | (M3) |
| GetEntry | GET /api/entries/{id} | (M3) |
| UpdateEntry (patch; soft warnings) | PATCH /api/entries/{id} | (M3) |
| MarkCanon (scoped: fields/body or all) | POST /api/entries/{id}/canon | (M3) |
| ListRevisions | GET /api/entries/{id}/revisions | (M3) |
| GetRevision (full snapshot) | GET /api/entries/{id}/revisions/{rid} | (M3) |
| RestoreRevision | POST /api/entries/{id}/revisions/{rid}/restore | (M3) |
| CreateEdge (soft warnings; cardinality-one replaces) | POST /api/entries/{id}/edges | (M3) |
| DeleteEdge (AI: draft only) | DELETE /api/edges/{id} | (M3) |
| Traverse (ego graph, depth 1–2) | GET /api/entries/{id}/graph?depth=N | (M3) |

## Query

- `find_relevant(query, canon_only?, near?: entry_ids, limit?)` →
  ranked entry cards with scores. THE search path — hybrid scorer:
  semantic (pgvector, if embeddings configured) + lexical (FTS/trigram)
  + graph proximity to `near` + canon weighting.
- `get_entry(id, detail: "card" | "digest" | "full")` → entry at chosen
  token cost. Full includes fields, edges (with annotations + status),
  reverse sections, status breakdown.
- `list_entries(type?, status?, sort?, limit?, cursor?)` → cards.
  Type filters include subtypes (single-inheritance semantics).
- `traverse(entry_id, field?, direction: out|in|both, depth: 1|2)` →
  the ego network: entries + edges.
- `get_schema(type)` / `list_schemas()` → field definitions incl.
  relation-field config and inheritance chain.

## Author (AI writes are always draft)

- `create_entry(type, title, fields?, body?)` → new draft entry.
- `update_entry(id, patch)` → edit fields/body. Refuses canon targets
  unless the call carries `canon_override` (set only when the user
  explicitly ordered the edit).
- `delete_entry(id)` → drafts only; canon deletion is human-only (UI).
- `create_edge(from, field, to, annotation?)` / `update_edge` /
  `delete_edge` → draft edges; same canon rules.
- `create_schema(name, parent?, fields)` / `update_schema` →
  soft-validated; warnings, not rejections.

## Status (promotion is human-gated)

- `get_status(entry_id)` → derived status breakdown (entry/fields/spans).
- Promotion to canon is **not an AI-callable tool**: `mark_canon` exists
  in the layer for the UI/API to call with a human session, and over MCP
  it requires the token's human owner — the MCP description marks it
  "only on explicit user instruction". (Tenet 4.)

## Context tray

- `get_context_tray()` → pins + auto items with serialization level and
  token counts.
- `pin_entry(id, with_neighbors?)` / `unpin_entry(id)`.
- `evict_auto_item(id)` — exclude a retrieved item for this conversation.

## Export

- `export_entry(id)` → Markdown (markers stripped).
- `export_world()` → Obsidian-style vault (zip): frontmatter,
  [[wikilinks]], folders per type.

## MCP extras (beyond tools)

- Resource: `lore://worlds/{id}/context-tray` — serialized tray.
- Prompt: `load-world-context` — serialized tray + world digest.
- Server instructions: tool-only clients should call `get_context_tray`
  and `find_relevant` before authoring.
