# 0013 — Relations present as one uniform section list

Status: proposed
Date: 2026-07-31
Amends: 0003 (relations are schema fields)

## Context

ADR 0003 gave entry pages two distinct relation views: declared
sections (fields on the entry's own type) and an auto-generated,
visually boxed "reverse" group for incoming edges whose field the
entry's type doesn't declare. The two views had different payload
shapes (`relations` vs `reverse`), different rendering, and different
editing affordances. User testing showed the distinction reads as
noise: a relation is a relation, whichever side stored the row.

## Decision

An entry exposes a single `relations` list. Every section has the
same shape — `{field, label, reverse?, config?, edges}` — and renders
and edits identically:

- Declared fields come first, in schema order, labeled by field name.
- Incoming edges whose field the entry's type also declares still
  merge into that declared section (the fix that killed duplicate
  Family sections stays).
- Leftover incoming edges form ordinary sections labeled by the
  pointing field's `inverse_label`, flagged `reverse: true`, and
  carrying the pointing field's config. The flag changes only the
  authoring direction: an add creates the edge target→here, in its
  canonical stored direction.
- Every `Edge.To` is "the other entry" from the viewing page's
  perspective; `Incoming` marks edges stored on the other side.
- `mentions` remains system-managed: rendered ("Mentioned in"), not
  hand-editable anywhere.

The `reverse` array and `ReverseSection`/`ReverseItem` types are gone
from the tool layer, API, MCP, exports, and context tray.

## Consequences

Clients get one code path for relations; headless consumers no longer
special-case two shapes. The cost: a section's meaning ("my schema
says this" vs "another type points here") is now a flag rather than a
structural split, so UIs that want to explain the difference must opt
in to showing it.
