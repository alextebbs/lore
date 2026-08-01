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

Per SPEC tenet 2, every row has all three surfaces. /mcp is streamable
HTTP; when MCP_TOKEN is set it requires `Authorization: Bearer`. AI
callers (MCP + agent) write as draft; the UI/API write as the human.

| Capability | HTTP | MCP tool |
|---|---|---|
| CreateWorld | POST /api/worlds | create_world |
| ListWorlds | GET /api/worlds | list_worlds |
| GetWorld + ListTypes | GET /api/worlds/{id} | get_world |
| ListEntries | GET /api/worlds/{id}/entries | list_entries |
| CreateEntry | POST /api/worlds/{id}/entries | create_entry |
| GetEntry | GET /api/entries/{id} | get_entry |
| UpdateEntry (patch; soft warnings) | PATCH /api/entries/{id} | update_entry |
| MarkCanon (scoped: fields/body/edges or all) | POST /api/entries/{id}/canon | mark_canon (human-gated) |
| ListRevisions | GET /api/entries/{id}/revisions | list_revisions |
| GetRevision (full snapshot) | GET /api/entries/{id}/revisions/{rid} | get_revision |
| RestoreRevision | POST /api/entries/{id}/revisions/{rid}/restore | restore_revision (human-gated) |
| CreateEdge (soft warnings; cardinality-one replaces) | POST /api/entries/{id}/edges | create_edge |
| DeleteEdge (AI: draft only) | DELETE /api/edges/{id} | delete_edge |
| UpdateEdgeStatus (draft/canon; AI: canon needs policy) | PATCH /api/edges/{id} | update_edge_status |
| Traverse (ego graph, depth 1–2) | GET /api/entries/{id}/graph?depth=N | traverse |
| FindRelevant (hybrid scorer — THE search path) | GET /api/worlds/{id}/search?q=&near=&canon_only= | find_relevant |
| Serializations (card/digest) | GET /api/entries/{id}?detail=card\|digest | get_entry(detail) |
| GetContextTray (pins+current+auto, ladder) | GET /api/worlds/{id}/tray?current=&q= | get_context_tray |
| PinEntry / UnpinEntry | POST/DELETE /api/worlds/{id}/tray/pins | pin_entry / unpin_entry |
| ExportEntry (clean vault markdown) | GET /api/entries/{id}/export | export_entry |
| ExportWorld (Obsidian vault) | GET /api/worlds/{id}/export (zip) | export_world (file list) |
| CreateEntryType (single inheritance, soft warnings) | POST /api/worlds/{id}/types | create_entry_type |
| DumpWorld (full-fidelity fixture) | GET /api/worlds/{id}/dump | dump_world |
| ImportWorld (rebuild from fixture) | POST /api/worlds/import | import_world |
| UpdateWorldSettings (vibe/style/policies) | PATCH /api/worlds/{id} | update_world_settings |
| DeleteEntry (AI: draft-only unless permitted) | DELETE /api/entries/{id} | delete_entry |
| DeleteWorld | DELETE /api/worlds/{id} | delete_world (human-gated) |
| UpdateEntryType (renames migrate edges+values) | PATCH /api/worlds/{id}/types/{typeId} | update_entry_type |

UI-only (SPEC tenet 2 exception — orchestration, not capability): the
chat harness (conversations/messages/evict endpoints) drives the agent
loop over the tools above; API/MCP consumers bring their own loop.

## Query

- `find_relevant(query, canon_only?, near?: entry_ids, limit?)` →
  ranked entry cards with scores. THE search path — hybrid scorer:
  semantic (pgvector, if embeddings configured) + lexical (FTS/trigram)
  + graph proximity to `near` + canon weighting.
- `get_entry(id, detail: "card" | "digest" | "full")` → entry at chosen
  token cost. Full includes fields, status breakdown, and a unified
  `relations` list (ADR 0013): every section `{field, label, reverse?,
  config?, edges}`, incoming edges merged or grouped under the pointing
  field's inverse label.
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
