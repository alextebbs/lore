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
	known := map[string]bool{"string": true, "number": true, "date": true, "richtext": true, "richtext_list": true, "relation": true}
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

// UpdateEntryType edits a type: rename it, replace its field list, and —
// critically — migrate data when fields are renamed: edges keyed by the
// old field name and entry field values both follow the rename, across
// the type and all its subtypes.
func (t *Tools) UpdateEntryType(ctx context.Context, worldID, typeID, name string, fields []FieldDef, renames map[string]string) (EntryType, []string, error) {
	wid, err := parseID(worldID)
	if err != nil {
		return EntryType{}, nil, err
	}
	tid, err := parseID(typeID)
	if err != nil {
		return EntryType{}, nil, err
	}
	row, err := t.store.Queries.GetEntryType(ctx, tid)
	if err != nil {
		return EntryType{}, nil, notFound(err)
	}
	if row.WorldID != wid {
		return EntryType{}, nil, ErrNotFound
	}
	if name == "" {
		name = row.Name
	}
	if fields == nil {
		if err := json.Unmarshal(row.Fields, &fields); err != nil {
			return EntryType{}, nil, err
		}
	}

	// Self + all descendant type ids (single inheritance, ADR 0004).
	all, err := t.store.Queries.ListEntryTypes(ctx, wid)
	if err != nil {
		return EntryType{}, nil, err
	}
	children := map[string][]pgtype.UUID{}
	for _, ty := range all {
		if ty.ParentID.Valid {
			children[idStr(ty.ParentID)] = append(children[idStr(ty.ParentID)], ty.ID)
		}
	}
	affected := []pgtype.UUID{tid}
	for i := 0; i < len(affected); i++ {
		affected = append(affected, children[idStr(affected[i])]...)
	}

	var warnings []string
	var out db.EntryType
	err = t.store.Tx(ctx, func(q *db.Queries) error {
		for oldName, newName := range renames {
			if oldName == newName || oldName == "" || newName == "" {
				continue
			}
			if err := q.RenameEdgeField(ctx, db.RenameEdgeFieldParams{
				Column1: affected, Field: oldName, Field_2: newName,
			}); err != nil {
				return fmt.Errorf("migrating edges %s→%s: %w", oldName, newName, err)
			}
			if err := q.RenameEntryFieldKey(ctx, db.RenameEntryFieldKeyParams{
				TypeIds: affected, OldName: oldName, NewName: newName,
			}); err != nil {
				return fmt.Errorf("migrating field values %s→%s: %w", oldName, newName, err)
			}
			warnings = append(warnings, fmt.Sprintf("migrated edges and values from %q to %q", oldName, newName))
		}
		raw, err := json.Marshal(fields)
		if err != nil {
			return err
		}
		out, err = q.UpdateEntryTypeRow(ctx, db.UpdateEntryTypeRowParams{
			ID: tid, Name: name, Fields: raw,
		})
		return err
	})
	if err != nil {
		return EntryType{}, nil, err
	}

	byID := make(map[string]db.EntryType, len(all))
	for _, r := range all {
		byID[idStr(r.ID)] = r
	}
	byID[idStr(out.ID)] = out
	et, err := typeOut(out, byID)
	return et, warnings, err
}
