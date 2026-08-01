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

| Capability | HTTP | MCP tool | TS client |
|---|---|---|---|
| ListWorlds | GET /api/worlds | list_worlds | listWorlds |
| CreateWorld | POST /api/worlds | create_world | createWorld |
| GetWorld — includes entry types | GET /api/worlds/{id} | get_world | getWorld |
| UpdateWorldSettings | PATCH /api/worlds/{id} | update_world_settings | updateWorldSettings |
| DeleteWorld | DELETE /api/worlds/{id} | delete_world | deleteWorld |
| ListEntries | GET /api/worlds/{id}/entries | list_entries | listEntries |
| CreateEntry | POST /api/worlds/{id}/entries | create_entry | createEntry |
| GetEntry — detail=card|digest|full | GET /api/entries/{id} | get_entry | getEntry |
| UpdateEntry — fields accept markdown or docs (ADR 0014) | PATCH /api/entries/{id} | update_entry | updateEntry |
| DeleteEntry — AI: draft only | DELETE /api/entries/{id} | delete_entry | deleteEntry |
| MarkCanon — scoped: fields/body/edges | POST /api/entries/{id}/canon | mark_canon | markCanon |
| ListRevisions | GET /api/entries/{id}/revisions | list_revisions | listRevisions |
| GetRevision | GET /api/entries/{id}/revisions/{rid} | get_revision | getRevision |
| RestoreRevision | POST /api/entries/{id}/revisions/{rid}/restore | restore_revision | restoreRevision |
| CreateEdge — cardinality-one replaces + warns | POST /api/entries/{id}/edges | create_edge | createEdge |
| DeleteEdge — AI: draft only | DELETE /api/edges/{id} | delete_edge | deleteEdge |
| UpdateEdgeStatus — draft/canon per edge | PATCH /api/edges/{id} | update_edge_status | updateEdgeStatus |
| Traverse — 1–2 hop ego network | GET /api/entries/{id}/graph | traverse | getGraph |
| FindRelevant — hybrid scorer (ADR 0010) | GET /api/worlds/{id}/search | find_relevant | search |
| ExportEntry — markdown download; TS uses a plain href | GET /api/entries/{id}/export | export_entry | — |
| ExportWorld — vault zip; TS uses a plain href | GET /api/worlds/{id}/export | export_world | — |
| CreateEntryType | POST /api/worlds/{id}/types | create_entry_type | createEntryType |
| UpdateEntryType — field identity survives renames (ADR 0015) | PATCH /api/worlds/{id}/types/{typeId} | update_entry_type | updateEntryType |
| DumpWorld — fixture format | GET /api/worlds/{id}/dump | dump_world | dumpWorld |
| ImportWorld — preserve_ids keeps URLs stable | POST /api/worlds/import | import_world | importWorld |
| ImportVault — markdown files/zip → draft entries; additive | POST /api/worlds/{id}/import-vault | import_vault | importVault |
| GetContextTray | GET /api/worlds/{id}/tray | get_context_tray | getTray |
| PinEntry | POST /api/worlds/{id}/tray/pins | pin_entry | createPin |
| UnpinEntry | DELETE /api/worlds/{id}/tray/pins/{entryId} | unpin_entry | deletePin |
| ListConversations — UI-only harness | GET /api/worlds/{id}/conversations | — | listConversations |
| CreateConversation — UI-only harness | POST /api/worlds/{id}/conversations | — | createConversation |
| GetConversation — UI-only harness | GET /api/conversations/{id} | — | getConversation |
| SendMessage — UI-only harness (SSE) | POST /api/conversations/{id}/messages | — | sendMessage |
| EvictAutoItem — UI-only harness | POST /api/conversations/{id}/evict | — | evictAutoItem |

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
