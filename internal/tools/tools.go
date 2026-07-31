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
}

func New(st *store.Store) *Tools {
	return &Tools{store: st}
}

// FieldDef is one schema field (soft schema, ADR 0004).
type FieldDef struct {
	Name  string `json:"name"`
	Kind  string `json:"kind"` // string | number | date | richtext | relation
	Label string `json:"label,omitempty"`
}

// FieldValue is one entry field's value plus its draft/canon status.
type FieldValue struct {
	Value  any    `json:"value"`
	Status string `json:"status"`
}

type World struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
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
