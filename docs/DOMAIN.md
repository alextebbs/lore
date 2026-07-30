# Domain glossary

Use these words — in code, docs, issues, and UI copy. One concept, one name.

- **World** — top-level container; a user owns many worlds. Every other
  object belongs to exactly one world.
- **Entry** — the universal content object (a Character, Place, Event,
  Item, Faction, or user-defined type). Has fields per its schema.
- **Schema** — the definition of an entry type: its fields and display
  config. Soft: scaffolds and warns, never rejects. Single inheritance
  (City → Place → Entry).
- **Field** — a named slot on a schema. Kinds: string, number, date,
  rich text, relation.
- **Relation field** — a field kind whose values are edges to other
  entries. Carries target type(s), cardinality, sentence template
  ("A is the hometown of B"), inverse label, and whether annotations are
  allowed.
- **Edge** — one stored relation instance:
  (from_entry, to_entry, field, annotation?, status). First-class row;
  has its own draft/canon status.
- **Annotation** — freeform note on an edge ("Jane is John's older
  sister"). Displayed, not interpreted.
- **Reverse section** — the auto-generated section on a target entry's
  page, labeled by the relation field's inverse label ("People from here").
- **Status** — `draft` or `canon`. Tracked at entry, field, and span
  granularity. Entry-level status is *derived* from its parts.
- **Draft** — AI-authored, awaiting human blessing. AI may freely modify
  or delete drafts.
- **Canon** — human-blessed world truth. AI never touches canon without an
  explicit order.
- **Span mark** — the draft/canon marking inside rich text (a ProseMirror
  mark). Serialized over MCP as `{~draft}...{/~}` markers in Markdown.
- **Revision** — append-only snapshot of an entry at a write, recording
  author (human vs AI). Drives the diff view and cache invalidation.
- **Serialization levels** — every entry renders at three sizes:
  **card** (one-liner), **digest** (paragraph), **full**. Cards and
  digests are AI-generated *derived* data — cached, revision-invalidated,
  outside draft/canon.
- **Tool layer** — the single Go registry of capabilities consumed by both
  the in-app agent loop and the MCP server. Contract in `docs/TOOLS.md`.
- **Context tray** — the per-user, per-world persistent set of entries in
  AI context: pinned items + current page + auto-retrieved items. Fully
  inspectable, token-metered.
- **Auto item** — a tray entry added by retrieval rather than the user;
  labeled as such, evictable, promotable to a pin.
- **Overflow ladder** — degradation order when context exceeds budget:
  full → digest → card → dropped.
- **Retrieval engine** — the hybrid scorer (semantic + lexical + graph
  proximity + canon weighting) behind the `find_relevant` tool. There is
  no other search path.
- **Ego network** — the graph view on an entry page: the entry plus
  neighbors 1–2 hops out.
- **Vault export** — Obsidian-style export: folder of .md files, YAML
  frontmatter, [[wikilinks]].
