# 0014 — Richtext field values are structured docs

Status: proposed
Date: 2026-08-01
Amends: 0001 (structured rich text, markdown at the edges)

## Context

Bodies stored structured docs (mention nodes with entry IDs, draft
span marks) while richtext/richtext_list *field* values stored raw
markdown strings. Two content models meant two mention pipelines
(nodes-by-ID vs. regex-by-title), two rename code paths, and a
client-side markdown parser duplicating `internal/richtext` logic in
TypeScript.

## Decision

Richtext and richtext_list field values store docs, exactly like
bodies. One pipeline everywhere:

- **Write boundary:** a richtext value may arrive as a markdown
  string or a doc object; both normalize to a mention-resolved doc
  (`coerceFieldValue`). Other kinds are untouched.
- **Read boundary:** `FieldValue.Value` still emits readable markdown
  (with `[[Title]]` links) so MCP/agent consumers are unchanged;
  `FieldValue.ValueDoc` carries the structured form for editors.
- **Mentions:** `collectMentions`, `propagateRename`, and the derived
  renderers all consume field docs through the same helpers as bodies.
  Field mentions now persist through IDs.
- **Migration:** ImportWorld's normalization pass converts legacy
  string values (statuses verbatim); reads tolerate leftover strings
  until their next write.
- **Client:** InlineField edits the doc directly; the hand-rolled
  parse/serialize pair is deleted.

Field-level draft/canon status is unchanged — fields keep one status
per value; span-level draft marks remain a body-only concept.

## Consequences

One content model, one mention pipeline, no duplicated parser. Cost:
field values in dumps/DB are heavier than plain strings, and any
consumer that reached for the raw stored value now needs the markdown
boundary (the tool layer already provides it).
