# Lore — AI-Native Worldbuilding

A worldbuilding application for D&D and other TTRPGs. A powerful standalone
worldbuilding tool that is also AI-native: everything the app can do, an AI
agent can do — and everything the AI writes stays clearly separated from
human-blessed canon until a human promotes it.

## Core tenets

1. All content is authorable by direct human input as well as through AI.
2. **The app is headless-first, with three first-class surfaces: the JSON
   API, the MCP server, and the UI.** Every capability is exposed through
   all three. Each surface stands alone — you can interact with the app
   fully using only the API, only MCP, or only the UI, or any mix. If you
   can do it in the app, you can do it via MCP; if you can do it in the
   UI, you can do it with curl.
3. All content carries **draft** / **canon** status metadata.
4. AI always authors in **draft**; only a human promotes content to canon.
5. AI may freely modify draft content; canon content is untouchable by AI
   unless explicitly ordered.

Tenet 2's structural consequence: the API, MCP server, and UI are all thin
adapters over one shared tool layer — none of them owns capability logic,
so surface parity holds by construction. A capability that exists on one
surface and not the others is a bug. Concretely: **every API endpoint has
a corresponding MCP tool** (both adapt the same tool-layer function), and
`docs/TOOLS.md` documents each capability with its tool name and its HTTP
route — a row missing either is a parity gap.

A second corollary, made explicit for the AI system: **capabilities are
exposed; orchestration is not.** Every engine (retrieval, serialization,
tray) is a public tool. The in-app agent is just a privileged MCP-shaped
client whose harness pre-calls those tools automatically. There is no
private API that outperforms what an external MCP client can reach.

The one deliberate exception to surface parity: **the in-app chat harness
is a UI-only feature.** It's a custom agent harness that happens to call
the same tools every other surface uses — there are no public API
endpoints or MCP tools to drive chats *inside* the in-app harness,
because an API or MCP consumer already has direct access to the same
tools and brings its own agent loop. Parity applies to capabilities, not
to harnesses.

## Stack

- **Frontend:** Vite + React SPA, TanStack Router + TanStack Query. No SSR,
  no Node server.
- **Backend:** Go — serves the JSON API, the MCP endpoint, the agent loop,
  and the built SPA's static files.
- **Database:** Postgres, with `pgvector` (embeddings) and built-in
  full-text search (`tsvector` / `pg_trgm`). One database for documents,
  edges, revisions, search, and vectors.
- **Hosting:** One Fly.io app (Go binary) + Postgres. One deploy, no CORS.
- **AI:** Anthropic API, **BYOK** — users provide their own API key, stored
  encrypted. Anthropic keys do not cover embeddings, so BYOK optionally
  includes an embeddings-provider key (Voyage AI); without one, retrieval
  degrades gracefully to full-text + graph scoring. Hosted/metered tier
  possible later.
- **Auth:** Email magic links (passwordless), sessions in Postgres, plus
  long-lived per-user API tokens for external MCP clients.

## Data model

### Entries

The universal object. Built-in types: **Character, Place, Event, Item,
Faction** — all user-extensible.

- An entry belongs to a **world**; users own multiple worlds (v1 is
  single-player; `world_id` + ownership baked in now so sharing can come
  later without migration).
- Fields are defined by the entry's **schema** (see below).
- Every entry has three serializations: **card** (one-line summary for
  lists and search results), **digest** (paragraph-level summary), and
  **full**. Cards and digests are AI-generated derived data — cached,
  regenerated lazily when a revision lands, and *outside* the draft/canon
  system (they describe content; they aren't world content).

### Rich text: structured storage, Markdown at the edges

- Rich text is stored as a structured document (ProseMirror/TipTap-style
  JSON). Draft/canon is a **span mark**, like bold.
- The MCP surface and agent speak Markdown with lightweight markers:
  `{~draft}...{/~}` — translated at the boundary by the server.
- Export renders clean Markdown with markers stripped.

### Draft / canon status

- Tracked at **three granularities**: entry, field, and span (within rich
  text). An entry's overall status is *derived* (e.g. "canon with 3 draft
  fields"); "mark as canon" on an entry bulk-canonizes everything inside.
- **Human-typed content is born canon by default** — a per-world policy
  (`humans_author_as`) can flip human authoring to draft-first. Draft
  effectively means "awaiting human blessing."
- AI has **full power over drafts**: it may create, modify, and delete
  draft entries and draft relations without explicit instruction. Revision
  history is the safety net. Canon requires explicit human orders (tenet
  5), enforced in the tool layer: AI writes touching canon are refused
  unless the world's `ai_can_edit_canon` policy allows them or the call
  carries `canon_override` (set only on explicit user instruction; prompt
  guidance urges caution even when permitted).

### Schemas

- A schema defines an entry type's fields. Field kinds: string, number,
  date, **richtext** (markdown w/ draft markers + mentions),
  **richtext_list** (a list of rich-text segments, e.g. Character
  "goals"), **relation**, (extensible).
- **Soft validation:** schemas scaffold the UI, prompt the AI, and produce
  warnings — they never reject data. Entries may carry extra or missing
  fields. Schema edits require no migrations.
- **Single inheritance:** each type has at most one parent
  (City → Place → Entry). Children inherit all fields, may add fields and
  override display config, may not remove or retype inherited fields.
  Queries for a parent type include its subtypes.
- Users **and agents** can create schemas (via the same tool layer).

### Relations are schema fields

There is no global relation registry. A **relation field** on a schema
carries its own config:

- target entry type(s)
- cardinality (one / many)
- sentence template with placeholders: "A is the hometown of B"
- inverse label for the reverse section
- whether per-edge freeform **annotations** are allowed
  (e.g. Family: link to Jane + note "Jane is John's older sister")

Typing *strength* is a schema-authoring choice: "Family" can be one loose
annotated multi-relation, or a user can define strict `Father` / `Siblings`
/ `Spouse` fields for Option-C rigor. The platform doesn't impose an
ontology.

- **Storage:** edges are first-class rows
  (`from_entry, to_entry, field, annotation, status, …`) so each relation
  has its own draft/canon status and feeds the graph.
- **Bidirectional presentation:** relationships never show a direction to
  the viewer. Incoming edges whose field the viewing entry's own schema
  declares merge into that section (family reads identically from both
  ends — no duplicate sections); everything else appears under the
  pointing field's inverse label — Character.hometown → Chicago shows
  "People from here: John". No wiring required on the target schema.
- **Mentions:** `[[Entry Title]]` inside a body or rich-text field links
  entries and auto-maintains a system relation annotated "mentioned in
  <section> of <entry>", surfaced on the target as "Mentioned in".

### Worlds: settings and the meta entry

Each world carries settings — capabilities on every surface:

- **vibe** — global context describing the setting's tone ("It's Elden
  Ring"), injected into all AI context.
- **style_prompt** — a writing primer layered on the default sourcebook
  style prompt that guides all AI authoring.
- **humans_author_as** — `canon` (default) or `draft`.
- **ai_can_edit_canon** — when true, AI may modify/delete canon without
  per-call override (still prompt-guided toward caution and explicit
  user direction).

Every world also owns a **meta entry** (builtin type `World`, seeded at
creation): the page describing the world itself. Its body is prime agent
context alongside the vibe.

### Dates

A `date` field kind = display string ("3rd of Frostfall, 402 AC") plus an
optional numeric sort key. Enables chronological sorting and a future
timeline view without a calendar engine. Custom calendar systems are
explicitly out of scope for v1.

### Revision history

Append-only snapshot on every write, recording author (human vs AI). Simple
diff viewer + "restore this revision". No branching. This is what makes
"AI has full power over drafts" safe. Revisions also drive cache
invalidation for cards, digests, and embeddings.

## Graph

- **v1: ego network on every entry page** — the entry plus neighbors 1–2
  hops out, filterable by relation field. Doubles as the picker for
  "pin entry + neighbors to context". Whole-world graph view deferred.

## AI system

### Agent architecture

- **One tool layer in Go**, consumed by both:
  - the in-app agent loop (Go backend → Anthropic API, user's key), and
  - the MCP server, exposed to external clients.
- **External MCP access ships day one**: remote MCP endpoint authenticated
  by per-user API tokens. Pointing Claude Code / Claude Desktop at your
  world is a flagship feature and keeps tenet 2 honest.

### Retrieval engine

One hybrid scorer, exposed as the search tool
`find_relevant(query, canon_only?, near?: entry_ids, limit)` → ranked
cards with scores. The blend:

- **semantic similarity** — pgvector over embeddings of each entry's card
  serialization (skipped when no embeddings key is configured)
- **lexical match** — full-text + trigram, so exact names always win
  ("Zara" finds Zara regardless of embedding quality)
- **graph proximity** — entries near the current page or pinned items
  (via the edges table) outrank equally-similar strangers
- **canon weighting** — canon outranks draft as world-truth; `canon_only`
  restricts to established facts

There is no separate private search API: the scorer *is* the search tool,
so in-app and MCP retrieval parity holds by construction.

### Context tray

- Pinned context **follows the user**: per-user, per-world, persisted
  across sessions. Pin a single entry or entry + connected neighbors.
- The currently viewed entry implicitly joins context.
- **Auto-retrieved items:** on each user message, the in-app harness runs
  `find_relevant` over the message + recent chat and injects the top
  results as clearly-labeled "auto" items — visually distinct from pins,
  individually evictable (excluded for the rest of the conversation) and
  promotable to real pins with one click.
- **Fully inspectable:** the tray lists everything in context with a token
  meter; users can expand any item to see the exact serialized text sent to
  the model.
- **Overflow ladder:** items degrade full → digest → card before anything
  is dropped.

### The in-app harness vs. external clients

Auto-injection — retrieval firing on every user message without the model
asking — is harness behavior. Lore cannot push tokens into an external
client's context window; the structural difference between owning the loop
and serving it is accepted, not papered over. External clients get the
same capabilities one explicit call away:

- **Tools** (lowest common denominator, always work): `find_relevant`,
  `get_entry(id, detail: card|digest|full)` — explicit token-cost control,
  `get_context_tray`, `pin_entry(id, with_neighbors?)`, `unpin_entry`.
  The tray is one persistent working set shared across surfaces: pin
  entries in the web app in the afternoon, open Claude Code that evening,
  and `get_context_tray` restores the same curated set.
- **MCP resource:** `lore://worlds/{id}/context-tray` — clients with
  resource support attach the serialized tray directly.
- **MCP prompt:** `load-world-context` — expands to the serialized tray
  plus a world digest; in Claude Code this is a slash command that
  reproduces most of the in-app harness's pre-loading.
- **Server instructions** tell tool-only clients to call
  `get_context_tray` and `find_relevant` before authoring.

### Agent tools (sketch)

Query: `find_relevant`, `get_entry` (card/digest/full), traverse
relations, list schemas. Author: create/update entries (draft),
create/delete draft relations, create schemas, propose edits to canon
(only when explicitly ordered). Context: `get_context_tray`, `pin_entry`,
`unpin_entry`.

## Export

**Obsidian-style vault**: export one entry or a whole world as a folder of
`.md` files — YAML frontmatter for fields, `[[wikilinks]]` for relations,
folders per type. Doubles as human-readable backup. Vault *import* deferred.
