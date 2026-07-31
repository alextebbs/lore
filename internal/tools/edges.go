package tools

import (
	"context"
	"fmt"
	"slices"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alextebbs/lore/internal/store/db"
)

// EntryRef is the light form an edge endpoint renders as.
type EntryRef struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	TypeName string `json:"type_name"`
	Status   string `json:"status"`
}

// Edge is one relation instance as seen from an entry. Relationships
// present bidirectionally: Incoming marks edges stored on the other
// entry but merged into this entry's matching section.
type Edge struct {
	ID         string   `json:"id"`
	Field      string   `json:"field"`
	To         EntryRef `json:"to"`
	Annotation string   `json:"annotation,omitempty"`
	Status     string   `json:"status"`
	Incoming   bool     `json:"incoming,omitempty"`
}

// RelationSection groups an entry's outgoing edges under its relation
// field definition, in schema order.
type RelationSection struct {
	Field  string          `json:"field"`
	Config *RelationConfig `json:"config,omitempty"`
	Edges  []Edge          `json:"edges"`
}

// ReverseSection is the auto-generated inverse view on a target page
// (ADR 0003): grouped by the pointing field's inverse label.
type ReverseSection struct {
	Label string        `json:"label"`
	Field string        `json:"field"` // the declaring side's field name
	Items []ReverseItem `json:"items"`
}

type ReverseItem struct {
	EdgeID     string   `json:"edge_id"`
	From       EntryRef `json:"from"`
	Annotation string   `json:"annotation,omitempty"`
	Status     string   `json:"status"`
}

// effectiveFields resolves a type's fields through its inheritance chain.
func (t *Tools) effectiveFields(ctx context.Context, worldID, typeID pgtype.UUID) ([]FieldDef, error) {
	rows, err := t.store.Queries.ListEntryTypes(ctx, worldID)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]db.EntryType, len(rows))
	for _, r := range rows {
		byID[idStr(r.ID)] = r
	}
	target, ok := byID[idStr(typeID)]
	if !ok {
		return nil, ErrNotFound
	}
	et, err := typeOut(target, byID)
	if err != nil {
		return nil, err
	}
	return et.Fields, nil
}

func fieldDefFor(fields []FieldDef, name string) *FieldDef {
	for i := range fields {
		if fields[i].Name == name {
			return &fields[i]
		}
	}
	return nil
}

// CreateEdge links two entries through a relation field. Author rules
// apply (ADR 0002): human edges are canon, AI edges draft. Soft schema
// (ADR 0004): undeclared fields and off-target types warn, not fail.
// Cardinality one replaces the existing edge.
func (t *Tools) CreateEdge(ctx context.Context, fromID, field, toID, annotation string, author Author) (Edge, []string, error) {
	if field == "" {
		return Edge{}, nil, fmt.Errorf("edge field is required")
	}
	fid, err := parseID(fromID)
	if err != nil {
		return Edge{}, nil, err
	}
	tid, err := parseID(toID)
	if err != nil {
		return Edge{}, nil, err
	}
	from, err := t.store.Queries.GetEntry(ctx, fid)
	if err != nil {
		return Edge{}, nil, notFound(err)
	}
	to, err := t.store.Queries.GetEntry(ctx, tid)
	if err != nil {
		return Edge{}, nil, notFound(err)
	}
	if from.WorldID != to.WorldID {
		return Edge{}, nil, fmt.Errorf("entries belong to different worlds")
	}
	toType, err := t.store.Queries.GetEntryType(ctx, to.TypeID)
	if err != nil {
		return Edge{}, nil, err
	}

	var warnings []string
	fields, err := t.effectiveFields(ctx, from.WorldID, from.TypeID)
	if err != nil {
		return Edge{}, nil, err
	}
	def := fieldDefFor(fields, field)
	switch {
	case field == RelatedField || field == MentionField:
		// system fields: always allowed, untyped, annotated freely
	case def == nil:
		warnings = append(warnings, fmt.Sprintf("field %q is not declared on this type", field))
	case def.Kind != "relation":
		warnings = append(warnings, fmt.Sprintf("field %q is not a relation field", field))
	case def.Relation != nil:
		if len(def.Relation.Targets) > 0 && !slices.Contains(def.Relation.Targets, toType.Name) {
			warnings = append(warnings, fmt.Sprintf("target type %s is not among %v", toType.Name, def.Relation.Targets))
		}
		if annotation != "" && !def.Relation.Annotations {
			warnings = append(warnings, fmt.Sprintf("field %q does not declare annotations", field))
		}
	}

	status := StatusCanon
	if author == AuthorAI {
		status = StatusDraft
	}

	var row db.Edge
	err = t.store.Tx(ctx, func(q *db.Queries) error {
		// Cardinality one: a new edge replaces the old one. AI cannot
		// silently replace a canon edge (tenet 5).
		if def != nil && def.Relation != nil && !def.Relation.Many {
			existing, err := q.ListEdgesFrom(ctx, fid)
			if err != nil {
				return err
			}
			for _, e := range existing {
				if e.Field == field {
					if author == AuthorAI && e.Status == StatusCanon {
						settings := WorldSettings{}
						if w, err := q.GetWorld(ctx, from.WorldID); err == nil {
							settings = parseSettings(w.Settings)
						}
						if !settings.AICanEditCanon {
							return fmt.Errorf("field %q holds a canon relation to %s; replacing it needs user permission", field, e.ToTitle)
						}
					}
					if err := q.DeleteEdge(ctx, e.ID); err != nil {
						return err
					}
					warnings = append(warnings, fmt.Sprintf("replaced the existing %q relation to %s (cardinality one)", field, e.ToTitle))
				}
			}
		}
		var err error
		row, err = q.CreateEdge(ctx, db.CreateEdgeParams{
			ID: newID(), WorldID: from.WorldID, FromEntry: fid,
			Field: field, ToEntry: tid, Annotation: annotation, Status: status,
		})
		if err != nil {
			return err
		}
		fromType, err := q.GetEntryType(ctx, from.TypeID)
		if err != nil {
			return err
		}
		return t.refreshDerived(ctx, q, from, fromType.Name)
	})
	if err != nil {
		return Edge{}, nil, fmt.Errorf("creating edge: %w", err)
	}
	return Edge{
		ID: idStr(row.ID), Field: row.Field, Annotation: row.Annotation,
		Status: row.Status,
		To: EntryRef{
			ID: idStr(to.ID), Title: to.Title, TypeName: toType.Name, Status: to.Status,
		},
	}, warnings, nil
}

// DeleteEdge removes a relation. AI may only delete draft edges —
// canon is untouchable without explicit human action (tenet 5).
func (t *Tools) DeleteEdge(ctx context.Context, id string, author Author) error {
	eid, err := parseID(id)
	if err != nil {
		return err
	}
	row, err := t.store.Queries.GetEdge(ctx, eid)
	if err != nil {
		return notFound(err)
	}
	if author == AuthorAI && row.Status == StatusCanon {
		settings := WorldSettings{}
		if w, err := t.store.Queries.GetWorld(ctx, row.WorldID); err == nil {
			settings = parseSettings(w.Settings)
		}
		if !settings.AICanEditCanon {
			return fmt.Errorf("canon edge cannot be deleted by AI without user permission")
		}
	}
	if err := t.store.Queries.DeleteEdge(ctx, eid); err != nil {
		return err
	}
	if from, err := t.store.Queries.GetEntry(ctx, row.FromEntry); err == nil {
		if et, err := t.store.Queries.GetEntryType(ctx, from.TypeID); err == nil {
			_ = t.refreshDerived(ctx, t.store.Queries, from, et.Name)
		}
	}
	return nil
}

// relationSections builds the outgoing and reverse views for an entry.
func (t *Tools) relationSections(ctx context.Context, row db.Entry) ([]RelationSection, []ReverseSection, error) {
	fields, err := t.effectiveFields(ctx, row.WorldID, row.TypeID)
	if err != nil {
		return nil, nil, err
	}

	outgoing, err := t.store.Queries.ListEdgesFrom(ctx, row.ID)
	if err != nil {
		return nil, nil, err
	}
	byField := map[string][]Edge{}
	for _, e := range outgoing {
		byField[e.Field] = append(byField[e.Field], Edge{
			ID: idStr(e.ID), Field: e.Field, Annotation: e.Annotation, Status: e.Status,
			To: EntryRef{
				ID: idStr(e.ToEntry), Title: e.ToTitle,
				TypeName: e.ToTypeName, Status: e.ToEntryStatus,
			},
		})
	}
	var sections []RelationSection
	for _, def := range fields {
		if def.Kind != "relation" {
			continue
		}
		sections = append(sections, RelationSection{
			Field: def.Name, Config: def.Relation, Edges: byField[def.Name],
		})
		delete(byField, def.Name)
	}
	// The universal untyped section: every entry can relate to anything.
	sections = append(sections, RelationSection{
		Field: RelatedField,
		Config: &RelationConfig{Many: true, Annotations: true, InverseLabel: "Related"},
		Edges:  byField[RelatedField],
	})
	delete(byField, RelatedField)
	// Undeclared relation fields with edges still render (soft schema).
	for field, edges := range byField {
		if field == MentionField {
			continue // mentions render on the target side only
		}
		sections = append(sections, RelationSection{Field: field, Edges: edges})
	}

	incoming, err := t.store.Queries.ListEdgesTo(ctx, row.ID)
	if err != nil {
		return nil, nil, err
	}
	// Bidirectional presentation: incoming edges whose field this
	// entry's own schema also declares merge into that section — a
	// family edge reads identically from both ends. Everything else
	// lands in a reverse section under the pointing field's inverse
	// label ("People from here", "Mentioned in").
	sectionIndex := map[string]int{}
	for i, sec := range sections {
		sectionIndex[sec.Field] = i
	}
	fieldsByType := map[string][]FieldDef{}
	var reverse []ReverseSection
	revIndex := map[string]int{}
	for _, e := range incoming {
		if i, ok := sectionIndex[e.Field]; ok && (e.Field == RelatedField || fieldDefFor(fields, e.Field) != nil) {
			sections[i].Edges = append(sections[i].Edges, Edge{
				ID: idStr(e.ID), Field: e.Field, Annotation: e.Annotation,
				Status: e.Status, Incoming: true,
				To: EntryRef{
					ID: idStr(e.FromEntry), Title: e.FromTitle,
					TypeName: e.FromTypeName, Status: e.FromEntryStatus,
				},
			})
			continue
		}
		key := idStr(e.FromTypeID)
		if _, ok := fieldsByType[key]; !ok {
			f, err := t.effectiveFields(ctx, e.WorldID, e.FromTypeID)
			if err != nil {
				return nil, nil, err
			}
			fieldsByType[key] = f
		}
		label := e.Field + " ←"
		if e.Field == MentionField {
			label = "Mentioned in"
		}
		if def := fieldDefFor(fieldsByType[key], e.Field); def != nil && def.Relation != nil && def.Relation.InverseLabel != "" {
			label = def.Relation.InverseLabel
		}
		item := ReverseItem{
			EdgeID: idStr(e.ID), Annotation: e.Annotation, Status: e.Status,
			From: EntryRef{
				ID: idStr(e.FromEntry), Title: e.FromTitle,
				TypeName: e.FromTypeName, Status: e.FromEntryStatus,
			},
		}
		if i, ok := revIndex[label]; ok {
			reverse[i].Items = append(reverse[i].Items, item)
		} else {
			revIndex[label] = len(reverse)
			reverse = append(reverse, ReverseSection{Label: label, Field: e.Field, Items: []ReverseItem{item}})
		}
	}
	return sections, reverse, nil
}

// Graph is a 1–2 hop ego network around an entry.
type Graph struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

type GraphNode struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	TypeName string `json:"type_name"`
	Status   string `json:"status"`
	Depth    int    `json:"depth"` // 0 = the entry itself
}

type GraphEdge struct {
	ID         string `json:"id"`
	From       string `json:"from"`
	To         string `json:"to"`
	Field      string `json:"field"`
	Annotation string `json:"annotation,omitempty"`
	Status     string `json:"status"`
}

func (t *Tools) Traverse(ctx context.Context, entryID string, depth int) (Graph, error) {
	if depth < 1 {
		depth = 1
	}
	if depth > 2 {
		depth = 2
	}
	eid, err := parseID(entryID)
	if err != nil {
		return Graph{}, err
	}
	if _, err := t.store.Queries.GetEntry(ctx, eid); err != nil {
		return Graph{}, notFound(err)
	}

	depthOf := map[string]int{entryID: 0}
	edgeSeen := map[string]bool{}
	var edges []GraphEdge
	frontier := []pgtype.UUID{eid}

	for d := 1; d <= depth; d++ {
		if len(frontier) == 0 {
			break
		}
		rows, err := t.store.Queries.ListEdgesTouching(ctx, frontier)
		if err != nil {
			return Graph{}, err
		}
		var next []pgtype.UUID
		for _, e := range rows {
			if !edgeSeen[idStr(e.ID)] {
				edgeSeen[idStr(e.ID)] = true
				edges = append(edges, GraphEdge{
					ID: idStr(e.ID), From: idStr(e.FromEntry), To: idStr(e.ToEntry),
					Field: e.Field, Annotation: e.Annotation, Status: e.Status,
				})
			}
			for _, end := range []pgtype.UUID{e.FromEntry, e.ToEntry} {
				if _, ok := depthOf[idStr(end)]; !ok {
					depthOf[idStr(end)] = d
					next = append(next, end)
				}
			}
		}
		frontier = next
	}

	ids := make([]pgtype.UUID, 0, len(depthOf))
	for id := range depthOf {
		u, err := parseID(id)
		if err != nil {
			return Graph{}, err
		}
		ids = append(ids, u)
	}
	rows, err := t.store.Queries.GetEntriesByIDs(ctx, ids)
	if err != nil {
		return Graph{}, err
	}
	nodes := make([]GraphNode, 0, len(rows))
	for _, r := range rows {
		nodes = append(nodes, GraphNode{
			ID: idStr(r.ID), Title: r.Title, TypeName: r.TypeName,
			Status: r.Status, Depth: depthOf[idStr(r.ID)],
		})
	}
	slices.SortFunc(nodes, func(a, b GraphNode) int {
		if a.Depth != b.Depth {
			return a.Depth - b.Depth
		}
		return int([]byte(a.ID)[0]) - int([]byte(b.ID)[0])
	})
	return Graph{Nodes: nodes, Edges: edges}, nil
}
