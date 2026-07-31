// Package tools is THE capability layer (ADR 0005): every way of reading
// or writing world content is a function here. HTTP handlers, the MCP
// server (M3), and the agent loop (M6) are all thin adapters over this
// package — none of them may reach into store directly.
//
// Draft/canon rules are enforced here (ADR 0002): human authorship is
// born canon, AI authorship is born draft, and every write records a
// revision (ADR 0011).
package tools

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alextebbs/lore/internal/richtext"
	"github.com/alextebbs/lore/internal/store"
)

// DevUserID owns everything until magic-link auth lands (M1).
const DevUserID = "00000000-0000-0000-0000-000000000001"

var ErrNotFound = errors.New("not found")

type Author string

const (
	AuthorHuman Author = "human"
	AuthorAI    Author = "ai"
)

const (
	StatusDraft = "draft"
	StatusCanon = "canon"
	StatusMixed = "mixed"
)

type Tools struct {
	store *store.Store
	// embedder receives (entry_id, card) after writes to refresh
	// semantic vectors; nil when embeddings are unavailable.
	embedder Embedder
	// semantic augments find_relevant when available.
	semantic SemanticSearcher
}

// Embedder consumes card updates for background embedding.
type Embedder interface {
	EnqueueEntry(entryID, card string)
}

// SemanticSearcher scores world entries against a query string.
type SemanticSearcher interface {
	// Similar returns entry_id -> similarity in [0,1]; ok=false when
	// semantic search is unavailable (no key, no pgvector).
	Similar(ctx context.Context, worldID, query string) (map[string]float64, bool)
}

func New(st *store.Store) *Tools {
	return &Tools{store: st}
}

// SetSemantic wires the optional retrieval engine in (both directions).
func (t *Tools) SetSemantic(e Embedder, s SemanticSearcher) {
	t.embedder = e
	t.semantic = s
}

// FieldDef is one schema field (soft schema, ADR 0004).
type FieldDef struct {
	Name     string          `json:"name"`
	Kind     string          `json:"kind"` // string | number | date | richtext | relation
	Label    string          `json:"label,omitempty"`
	Relation *RelationConfig `json:"relation,omitempty"` // when Kind == "relation"
}

// RelationConfig is a relation field's schema-level config (ADR 0003):
// the type registry lives on the schema, not in a global table.
type RelationConfig struct {
	Targets      []string `json:"targets,omitempty"` // allowed target type names; empty = any
	Many         bool     `json:"many,omitempty"`
	InverseLabel string   `json:"inverse_label,omitempty"` // target page section title
	Annotations  bool     `json:"annotations,omitempty"`   // per-edge freeform notes
}

// FieldValue is one entry field's value plus its draft/canon status.
type FieldValue struct {
	Value  any    `json:"value"`
	Status string `json:"status"`
}

type World struct {
	ID        string        `json:"id"`
	Name      string        `json:"name"`
	Settings  WorldSettings `json:"settings"`
	CreatedAt time.Time     `json:"created_at"`
}

// WorldSettings are world-level knobs (SPEC): global context for the
// agent, a writing-style primer, and the authoring policies.
type WorldSettings struct {
	// Vibe describes the world's overall setting/tone ("It's Elden
	// Ring", "hopepunk solarcity") — injected into agent context.
	Vibe string `json:"vibe,omitempty"`
	// StylePrompt primes AI writers (e.g. toward WoTC sourcebook prose).
	StylePrompt string `json:"style_prompt,omitempty"`
	// HumansAuthorAs: "canon" (default) or "draft".
	HumansAuthorAs string `json:"humans_author_as,omitempty"`
	// AICanEditCanon permits AI modification/deletion of canon content
	// without per-call override (still prompt-guided toward caution).
	AICanEditCanon bool `json:"ai_can_edit_canon,omitempty"`
}

func (s WorldSettings) humanStatus() string {
	if s.HumansAuthorAs == StatusDraft {
		return StatusDraft
	}
	return StatusCanon
}

type EntryType struct {
	ID       string     `json:"id"`
	Name     string     `json:"name"`
	ParentID string     `json:"parent_id,omitempty"`
	Fields   []FieldDef `json:"fields"`
	Builtin  bool       `json:"builtin"`
}

type EntrySummary struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	TypeID   string `json:"type_id"`
	TypeName string `json:"type_name"`
	Status   string `json:"status"`
}

type Entry struct {
	ID        string                `json:"id"`
	WorldID   string                `json:"world_id"`
	TypeID    string                `json:"type_id"`
	TypeName  string                `json:"type_name"`
	Title     string                `json:"title"`
	Fields    map[string]FieldValue `json:"fields"`
	BodyMD    string                `json:"body_md"`  // markdown with {~draft} markers
	BodyDoc   richtext.Node         `json:"body_doc"` // structured doc, draft as span mark
	Status    string                `json:"status"`
	UpdatedAt time.Time             `json:"updated_at"`
	Relations []RelationSection     `json:"relations"` // outgoing edges by field
	Reverse   []ReverseSection      `json:"reverse"`   // auto inverse sections
}

type Revision struct {
	ID        string    `json:"id"`
	Author    string    `json:"author"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

func newID() pgtype.UUID {
	id, err := uuid.NewV7()
	if err != nil {
		panic(err) // only fails if the entropy source is broken
	}
	return pgtype.UUID{Bytes: id, Valid: true}
}

func parseID(s string) (pgtype.UUID, error) {
	id, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}, fmt.Errorf("%w: bad id %q", ErrNotFound, s)
	}
	return pgtype.UUID{Bytes: id, Valid: true}, nil
}

func idStr(u pgtype.UUID) string {
	return uuid.UUID(u.Bytes).String()
}

func notFound(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}
