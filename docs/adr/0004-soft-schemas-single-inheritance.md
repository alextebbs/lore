# ADR 0004: Soft schemas with single inheritance

Status: accepted (2026-07-27)

## Context

Users and agents can define entry types. Strict validation would require
migrations on schema edits and make AI writes fail often; inheritance
semantics needed deciding.

## Decision

- **Soft validation:** schemas scaffold UI, prompt the AI, and produce
  warnings — they never reject data. Entries may carry extra or missing
  fields. Schema edits require no migrations.
- **Single inheritance:** each type has at most one parent
  (City → Place → Entry). Children inherit all fields, may add fields and
  override display config, may not remove or retype inherited fields.
  Queries for a parent type include subtypes. No mixins.

## Consequences

- Forgiving for AI authoring; no migration machinery.
- Data can drift from schema; UI must render unknown fields gracefully
  and surface warnings.
- Entry fields stored as JSONB (ADR 0006) rather than columns.
