# ADR 0003: Relations are schema fields; edges are first-class rows

Status: accepted (2026-07-27)

## Context

Relationships need to be queryable (Members/Residents sections, graph,
"all Guild members"), carry freeform nuance ("Jane is John's older
sister"), and have their own draft/canon status. A global relation-type
registry was considered, as was full kinship ontology and fully freeform
edges.

## Decision

There is no global relation registry and no platform ontology. A
**relation field** on an entry schema carries the config: target type(s),
cardinality, sentence template ("A is the hometown of B"), inverse label,
and whether per-edge annotations are allowed. Typing *strength* is a
schema-authoring choice: "Family" can be one loose annotated
multi-relation, or a user defines strict Father/Siblings/Spouse fields.

Storage: edges are first-class rows
(from_entry, to_entry, field, annotation?, status) — each edge has its own
draft/canon status and feeds the graph. Target pages automatically grow
**reverse sections** from the inverse label; no wiring on the target
schema.

## Consequences

- Queryable graph + freeform nuance without imposing a kinship ontology.
- Computed family trees are not possible with loose family fields; users
  wanting that rigor model it in their schema.
- Annotations are displayed, never interpreted.
