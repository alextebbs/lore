package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alextebbs/lore/internal/store/db"
)

// WorldDump is the full-fidelity fixture format: everything needed to
// rebuild a world after a database wipe — custom types, entries with raw
// body docs and field-level statuses, edges with annotations and
// statuses. IDs are remapped on import, so a dump can be loaded any
// number of times.
type WorldDump struct {
	Version int         `json:"version"`
	World   string      `json:"world"`
	Types   []TypeDump  `json:"types"`
	Entries []EntryDump `json:"entries"`
	Edges   []EdgeDump  `json:"edges"`
}

type TypeDump struct {
	ID       string          `json:"id"`
	Name     string          `json:"name"`
	ParentID string          `json:"parent_id,omitempty"`
	Fields   json.RawMessage `json:"fields"`
	Builtin  bool            `json:"builtin"`
}

type EntryDump struct {
	ID     string          `json:"id"`
	TypeID string          `json:"type_id"`
	Title  string          `json:"title"`
	Fields json.RawMessage `json:"fields"` // {name: {value, status}}
	Body   json.RawMessage `json:"body"`   // structured doc with draft marks
	Status string          `json:"status"`
}

type EdgeDump struct {
	FromEntry  string `json:"from_entry"`
	Field      string `json:"field"`
	ToEntry    string `json:"to_entry"`
	Annotation string `json:"annotation,omitempty"`
	Status     string `json:"status"`
}

// DumpWorld exports a world as a fixture.
func (t *Tools) DumpWorld(ctx context.Context, worldID string) (WorldDump, error) {
	wid, err := parseID(worldID)
	if err != nil {
		return WorldDump{}, err
	}
	world, err := t.store.Queries.GetWorld(ctx, wid)
	if err != nil {
		return WorldDump{}, notFound(err)
	}
	dump := WorldDump{Version: 1, World: world.Name}

	types, err := t.store.Queries.ListEntryTypes(ctx, wid)
	if err != nil {
		return WorldDump{}, err
	}
	for _, ty := range types {
		td := TypeDump{
			ID: idStr(ty.ID), Name: ty.Name, Fields: ty.Fields, Builtin: ty.Builtin,
		}
		if ty.ParentID.Valid {
			td.ParentID = idStr(ty.ParentID)
		}
		dump.Types = append(dump.Types, td)
	}

	rows, err := t.store.Queries.ListEntryRows(ctx, wid)
	if err != nil {
		return WorldDump{}, err
	}
	for _, e := range rows {
		dump.Entries = append(dump.Entries, EntryDump{
			ID: idStr(e.ID), TypeID: idStr(e.TypeID), Title: e.Title,
			Fields: e.Fields, Body: e.Body, Status: e.Status,
		})
	}

	edges, err := t.store.Queries.ListEdgeRows(ctx, wid)
	if err != nil {
		return WorldDump{}, err
	}
	for _, e := range edges {
		dump.Edges = append(dump.Edges, EdgeDump{
			FromEntry: idStr(e.FromEntry), Field: e.Field, ToEntry: idStr(e.ToEntry),
			Annotation: e.Annotation, Status: e.Status,
		})
	}
	return dump, nil
}

// ImportWorld rebuilds a dumped world under a (possibly new) name.
// All IDs are freshly minted and remapped; statuses, annotations, and
// draft marks come through verbatim. Each entry gets one initial
// revision and fresh derived rows.
func (t *Tools) ImportWorld(ctx context.Context, dump WorldDump, name string) (World, error) {
	if dump.Version != 1 {
		return World{}, fmt.Errorf("unsupported dump version %d", dump.Version)
	}
	if name == "" {
		name = dump.World
	}
	owner, _ := parseID(DevUserID)

	var out World
	err := t.store.Tx(ctx, func(q *db.Queries) error {
		w, err := q.CreateWorld(ctx, db.CreateWorldParams{
			ID: newID(), OwnerID: owner, Name: name,
		})
		if err != nil {
			return err
		}
		out = worldOut(w)

		// Types first (parents before children — insert in dependency order).
		typeMap := map[string]pgtype.UUID{}
		remaining := append([]TypeDump{}, dump.Types...)
		for len(remaining) > 0 {
			progressed := false
			var next []TypeDump
			for _, td := range remaining {
				if td.ParentID != "" {
					if _, ok := typeMap[td.ParentID]; !ok {
						next = append(next, td)
						continue
					}
				}
				id := newID()
				parent := pgtype.UUID{}
				if td.ParentID != "" {
					parent = typeMap[td.ParentID]
				}
				if _, err := q.CreateEntryType(ctx, db.CreateEntryTypeParams{
					ID: id, WorldID: w.ID, Name: td.Name, ParentID: parent,
					Fields: td.Fields, Builtin: td.Builtin,
				}); err != nil {
					return fmt.Errorf("importing type %s: %w", td.Name, err)
				}
				typeMap[td.ID] = id
				progressed = true
			}
			if !progressed {
				return fmt.Errorf("type parent cycle or missing parent in dump")
			}
			remaining = next
		}

		entryMap := map[string]pgtype.UUID{}
		typeName := map[pgtype.UUID]string{}
		for old, id := range typeMap {
			for _, td := range dump.Types {
				if td.ID == old {
					typeName[id] = td.Name
				}
			}
		}
		for _, ed := range dump.Entries {
			tid, ok := typeMap[ed.TypeID]
			if !ok {
				return fmt.Errorf("entry %q references unknown type %s", ed.Title, ed.TypeID)
			}
			id := newID()
			row, err := q.CreateEntry(ctx, db.CreateEntryParams{
				ID: id, WorldID: w.ID, TypeID: tid, Title: ed.Title,
				Fields: ed.Fields, Body: ed.Body, Status: ed.Status,
			})
			if err != nil {
				return fmt.Errorf("importing entry %q: %w", ed.Title, err)
			}
			entryMap[ed.ID] = id
			author := AuthorHuman
			if ed.Status == StatusDraft {
				author = AuthorAI
			}
			if err := recordRevision(ctx, q, row, author); err != nil {
				return err
			}
		}

		for _, eg := range dump.Edges {
			from, ok := entryMap[eg.FromEntry]
			if !ok {
				return fmt.Errorf("edge references unknown entry %s", eg.FromEntry)
			}
			to, ok := entryMap[eg.ToEntry]
			if !ok {
				return fmt.Errorf("edge references unknown entry %s", eg.ToEntry)
			}
			if _, err := q.CreateEdge(ctx, db.CreateEdgeParams{
				ID: newID(), WorldID: w.ID, FromEntry: from, Field: eg.Field,
				ToEntry: to, Annotation: eg.Annotation, Status: eg.Status,
			}); err != nil {
				return err
			}
		}

		// Derived rows (cards/digests/search) for every imported entry.
		for _, id := range entryMap {
			row, err := q.GetEntry(ctx, id)
			if err != nil {
				return err
			}
			if err := t.refreshDerived(ctx, q, row, typeName[row.TypeID]); err != nil {
				return err
			}
		}
		return nil
	})
	return out, err
}
