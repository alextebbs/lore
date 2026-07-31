package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alextebbs/lore/internal/store/db"
)

// CreateEntryType defines a new entry type in a world (SPEC: users AND
// agents can create schemas). Single inheritance (ADR 0004): parentID
// optional; the child inherits the parent's fields and may add more.
// Soft validation: field kinds are advisory, unknown kinds warn.
func (t *Tools) CreateEntryType(ctx context.Context, worldID, name, parentID string, fields []FieldDef) (EntryType, []string, error) {
	if name == "" {
		return EntryType{}, nil, fmt.Errorf("type name is required")
	}
	wid, err := parseID(worldID)
	if err != nil {
		return EntryType{}, nil, err
	}

	var parent pgtype.UUID
	if parentID != "" {
		parent, err = parseID(parentID)
		if err != nil {
			return EntryType{}, nil, err
		}
		p, err := t.store.Queries.GetEntryType(ctx, parent)
		if err != nil {
			return EntryType{}, nil, notFound(err)
		}
		if p.WorldID != wid {
			return EntryType{}, nil, fmt.Errorf("parent type belongs to a different world")
		}
	}

	var warnings []string
	known := map[string]bool{"string": true, "number": true, "date": true, "richtext": true, "relation": true}
	for _, f := range fields {
		if f.Name == "" {
			return EntryType{}, nil, fmt.Errorf("every field needs a name")
		}
		if !known[f.Kind] {
			warnings = append(warnings, fmt.Sprintf("field %q has unknown kind %q (soft schema: accepted)", f.Name, f.Kind))
		}
		if f.Kind == "relation" && f.Relation == nil {
			warnings = append(warnings, fmt.Sprintf("relation field %q has no relation config", f.Name))
		}
	}

	raw, err := json.Marshal(fields)
	if err != nil {
		return EntryType{}, nil, err
	}
	row, err := t.store.Queries.CreateEntryType(ctx, db.CreateEntryTypeParams{
		ID: newID(), WorldID: wid, Name: name, ParentID: parent,
		Fields: raw, Builtin: false,
	})
	if err != nil {
		return EntryType{}, nil, fmt.Errorf("creating type: %w", err)
	}

	// Resolve effective fields through the chain for the response.
	all, err := t.store.Queries.ListEntryTypes(ctx, wid)
	if err != nil {
		return EntryType{}, nil, err
	}
	byID := make(map[string]db.EntryType, len(all))
	for _, r := range all {
		byID[idStr(r.ID)] = r
	}
	out, err := typeOut(row, byID)
	return out, warnings, err
}
