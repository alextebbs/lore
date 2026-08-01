package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alextebbs/lore/internal/store/db"
)

// builtinTypes seed every new world (SPEC: Character, Place, Event, Item,
// Faction — all user-extensible).
var builtinTypes = []struct {
	Name   string
	Fields []FieldDef
}{
	{"Character", []FieldDef{
		{Name: "gender", Kind: "string"},
		{Name: "occupation", Kind: "string"},
		{Name: "origin", Kind: "richtext"},
		{Name: "goals", Kind: "richtext_list"},
		{Name: "hometown", Kind: "relation", Relation: &RelationConfig{
			Targets: []string{"Place"},
			InverseLabel: "People from here",
		}},
		{Name: "family", Kind: "relation", Relation: &RelationConfig{
			Targets: []string{"Character"}, Many: true, Annotations: true,
			InverseLabel: "Family",
		}},
	}},
	{"Place", []FieldDef{
		{Name: "kind", Kind: "string", Label: "Kind (city, region, dungeon…)"},
		{Name: "located_in", Kind: "relation", Relation: &RelationConfig{
			Targets: []string{"Place"},
			InverseLabel: "Places within",
		}},
	}},
	{"Event", []FieldDef{
		{Name: "date", Kind: "date"},
		{Name: "location", Kind: "relation", Relation: &RelationConfig{
			Targets: []string{"Place"},
			InverseLabel: "Events here",
		}},
		{Name: "participants", Kind: "relation", Relation: &RelationConfig{
			Targets: []string{"Character", "Faction"}, Many: true, Annotations: true,
			InverseLabel: "Involved in",
		}},
	}},
	{"Item", []FieldDef{
		{Name: "kind", Kind: "string"},
		{Name: "wielder", Kind: "relation", Relation: &RelationConfig{
			Targets: []string{"Character"},
			InverseLabel: "Wields",
		}},
		{Name: "location", Kind: "relation", Relation: &RelationConfig{
			Targets: []string{"Place"},
			InverseLabel: "Items here",
		}},
	}},
	{"Faction", []FieldDef{
		{Name: "purpose", Kind: "string"},
		{Name: "members", Kind: "relation", Relation: &RelationConfig{
			Targets: []string{"Character"}, Many: true, Annotations: true,
			InverseLabel: "Member of",
		}},
		{Name: "base", Kind: "relation", Relation: &RelationConfig{
			Targets: []string{"Place"},
			InverseLabel: "Factions based here",
		}},
	}},
	// Generic concept pages — the Fall, the Fog, a calendar, a law —
	// worldbuilding that deserves an entry but no bespoke schema. Body
	// plus the universal related/mentions relations carry everything.
	{"Lore", nil},
	// The world's own page: one meta entry per world describes the
	// setting itself (its body is prime agent context).
	{"World", nil},
}

func (t *Tools) CreateWorld(ctx context.Context, name string) (World, error) {
	if name == "" {
		return World{}, fmt.Errorf("world name is required")
	}
	owner, err := parseID(DevUserID)
	if err != nil {
		return World{}, err
	}

	var out World
	err = t.store.Tx(ctx, func(q *db.Queries) error {
		w, err := q.CreateWorld(ctx, db.CreateWorldParams{
			ID: newID(), OwnerID: owner, Name: name,
		})
		if err != nil {
			return fmt.Errorf("creating world: %w", err)
		}
		var worldTypeID pgtype.UUID
		for _, bt := range builtinTypes {
			defs := append([]FieldDef(nil), bt.Fields...)
			ensureFieldIDs(defs)
			fields, err := json.Marshal(defs)
			if err != nil {
				return err
			}
			ty, err := q.CreateEntryType(ctx, db.CreateEntryTypeParams{
				ID: newID(), WorldID: w.ID, Name: bt.Name,
				ParentID: pgtype.UUID{}, Fields: fields, Builtin: true,
			})
			if err != nil {
				return fmt.Errorf("seeding type %s: %w", bt.Name, err)
			}
			if bt.Name == "World" {
				worldTypeID = ty.ID
			}
		}
		// The world's meta entry: a page describing the world itself.
		meta, err := q.CreateEntry(ctx, db.CreateEntryParams{
			ID: newID(), WorldID: w.ID, TypeID: worldTypeID, Title: name,
			Fields: []byte("{}"), Body: []byte(`{"type":"doc"}`), Status: StatusCanon,
		})
		if err != nil {
			return fmt.Errorf("creating meta entry: %w", err)
		}
		if err := recordRevision(ctx, q, meta, AuthorHuman); err != nil {
			return err
		}
		if err := t.refreshDerived(ctx, q, meta, "World"); err != nil {
			return err
		}
		out = worldOut(w)
		return nil
	})
	return out, err
}

// GetWorldSettings loads a world's settings.
func (t *Tools) GetWorldSettings(ctx context.Context, worldID string) (WorldSettings, error) {
	wid, err := parseID(worldID)
	if err != nil {
		return WorldSettings{}, err
	}
	w, err := t.store.Queries.GetWorld(ctx, wid)
	if err != nil {
		return WorldSettings{}, notFound(err)
	}
	return parseSettings(w.Settings), nil
}

// UpdateWorldSettings replaces a world's settings (all surfaces).
func (t *Tools) UpdateWorldSettings(ctx context.Context, worldID string, s WorldSettings) (World, error) {
	wid, err := parseID(worldID)
	if err != nil {
		return World{}, err
	}
	if s.HumansAuthorAs != "" && s.HumansAuthorAs != StatusDraft && s.HumansAuthorAs != StatusCanon {
		return World{}, fmt.Errorf("humans_author_as must be draft or canon")
	}
	if w, err := t.store.Queries.GetWorld(ctx, wid); err == nil {
		if err := t.checkWorldOwner(w); err != nil {
			return World{}, err
		}
	}
	raw, err := json.Marshal(s)
	if err != nil {
		return World{}, err
	}
	w, err := t.store.Queries.UpdateWorldSettings(ctx, db.UpdateWorldSettingsParams{
		ID: wid, Settings: raw,
	})
	if err != nil {
		return World{}, notFound(err)
	}
	return worldOut(w), nil
}

// DeleteWorld permanently removes a world and everything in it.
// Human-gated: exposed to the UI/API; over MCP only on explicit user
// instruction.
func (t *Tools) DeleteWorld(ctx context.Context, worldID string) error {
	wid, err := parseID(worldID)
	if err != nil {
		return err
	}
	if w, err := t.store.Queries.GetWorld(ctx, wid); err == nil {
		if err := t.checkWorldOwner(w); err != nil {
			return err
		}
	}
	return t.store.Queries.DeleteWorld(ctx, wid)
}

func parseSettings(raw []byte) WorldSettings {
	var s WorldSettings
	_ = json.Unmarshal(raw, &s)
	return s
}

func (t *Tools) ListWorlds(ctx context.Context) ([]World, error) {
	owner, err := parseID(DevUserID)
	if err != nil {
		return nil, err
	}
	rows, err := t.store.Queries.ListWorlds(ctx, owner)
	if err != nil {
		return nil, err
	}
	worlds := make([]World, 0, len(rows))
	for _, w := range rows {
		worlds = append(worlds, worldOut(w))
	}
	return worlds, nil
}

func (t *Tools) GetWorld(ctx context.Context, id string) (World, error) {
	wid, err := parseID(id)
	if err != nil {
		return World{}, err
	}
	w, err := t.store.Queries.GetWorld(ctx, wid)
	if err != nil {
		return World{}, notFound(err)
	}
	return worldOut(w), nil
}

// ListTypes returns a world's entry types with *effective* fields —
// inherited fields resolved through the single-inheritance chain
// (ADR 0004).
func (t *Tools) ListTypes(ctx context.Context, worldID string) ([]EntryType, error) {
	wid, err := parseID(worldID)
	if err != nil {
		return nil, err
	}
	rows, err := t.store.Queries.ListEntryTypes(ctx, wid)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]db.EntryType, len(rows))
	for _, r := range rows {
		byID[idStr(r.ID)] = r
	}
	types := make([]EntryType, 0, len(rows))
	for _, r := range rows {
		et, err := typeOut(r, byID)
		if err != nil {
			return nil, err
		}
		types = append(types, et)
	}
	return types, nil
}

func worldOut(w db.World) World {
	return World{
		ID: idStr(w.ID), Name: w.Name,
		Settings: parseSettings(w.Settings), CreatedAt: w.CreatedAt.Time,
	}
}

// typeOut resolves effective fields: ancestors first, child additions
// after; a child redeclaring a name keeps the ancestor's position.
func typeOut(r db.EntryType, byID map[string]db.EntryType) (EntryType, error) {
	chain := []db.EntryType{r}
	cur := r
	for cur.ParentID.Valid {
		parent, ok := byID[idStr(cur.ParentID)]
		if !ok {
			break
		}
		chain = append([]db.EntryType{parent}, chain...)
		cur = parent
	}
	var effective []FieldDef
	seen := map[string]int{}
	for _, link := range chain {
		var fields []FieldDef
		if err := json.Unmarshal(link.Fields, &fields); err != nil {
			return EntryType{}, fmt.Errorf("bad fields on type %s: %w", link.Name, err)
		}
		for _, f := range fields {
			if i, ok := seen[f.Name]; ok {
				effective[i] = f
				continue
			}
			seen[f.Name] = len(effective)
			effective = append(effective, f)
		}
	}
	if effective == nil {
		effective = []FieldDef{}
	}
	et := EntryType{
		ID: idStr(r.ID), Name: r.Name, Builtin: r.Builtin,
		Fields: effective,
	}
	if r.ParentID.Valid {
		et.ParentID = idStr(r.ParentID)
	}
	return et, nil
}
