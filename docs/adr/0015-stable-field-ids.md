# 0015 — Schema fields have stable IDs; edges reference them

Status: proposed
Date: 2026-08-01
Amends: 0003 (relations are schema fields), 0013 (unified sections)

## Context

Edges stored only the relation field's *name*. Renaming a field
required data migration (`RenameEdgeField`), and the unified-section
merge matched incoming edges by name — two types declaring same-named
fields with different meanings would silently merge.

## Decision

- Every `FieldDef` carries a stable `id` (UUIDv7), assigned at type
  creation/import and never rewritten. On type updates, incoming
  fields without an ID inherit the existing field's — matched through
  the rename map or unchanged name — so identity survives edits.
- Edges carry `field_id` alongside the display name. System relations
  use fixed IDs: `sys:mentions`, `sys:related`.
- Section merging and reverse-label resolution match by `field_id`
  first; name matching remains only as the fallback for legacy rows
  with an empty `field_id` (pre-migration edges, old dumps — imports
  backfill IDs by resolving the declaring type's fields).
- Dump format carries `field_id` on edges and `id` inside type fields;
  both survive import verbatim.

## Consequences

Renames become metadata edits (the name-migration path remains only
for legacy name-matched rows and can be retired once none exist).
Cross-type name collisions can no longer merge sections incorrectly.
Cost: one more column and the sys:* convention for schema-less
relations.
