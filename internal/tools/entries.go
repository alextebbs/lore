package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"

	"github.com/alextebbs/lore/internal/richtext"
	"github.com/alextebbs/lore/internal/store/db"
)

func (t *Tools) CreateEntry(ctx context.Context, worldID, typeID, title string, author Author) (Entry, error) {
	if title == "" {
		return Entry{}, fmt.Errorf("entry title is required")
	}
	wid, err := parseID(worldID)
	if err != nil {
		return Entry{}, err
	}
	tid, err := parseID(typeID)
	if err != nil {
		return Entry{}, err
	}
	et, err := t.store.Queries.GetEntryType(ctx, tid)
	if err != nil {
		return Entry{}, notFound(err)
	}

	settings, err := t.GetWorldSettings(ctx, worldID)
	if err != nil {
		return Entry{}, err
	}
	status := settings.humanStatus()
	if author == AuthorAI {
		status = StatusDraft
	}
	emptyDoc, _ := json.Marshal(richtext.EmptyDoc())

	var row db.Entry
	err = t.store.Tx(ctx, func(q *db.Queries) error {
		var err error
		row, err = q.CreateEntry(ctx, db.CreateEntryParams{
			ID: newID(), WorldID: wid, TypeID: tid, Title: title,
			Fields: []byte("{}"), Body: emptyDoc, Status: status,
		})
		if err != nil {
			return fmt.Errorf("creating entry: %w", err)
		}
		if err := recordRevision(ctx, q, row, author); err != nil {
			return err
		}
		if err := t.refreshDerived(ctx, q, row, et.Name); err != nil {
			return err
		}
		return t.syncMentions(ctx, q, row, author)
	})
	if err != nil {
		return Entry{}, err
	}
	return t.entryFull(ctx, row, et.Name)
}

// EntryPatch carries partial updates; nil means "leave unchanged".
// BodyDoc takes precedence over BodyMD when both are set.
type EntryPatch struct {
	Title   *string        `json:"title"`
	Fields  map[string]any `json:"fields"` // value nil deletes the field
	BodyMD  *string        `json:"body_md"`
	BodyDoc *richtext.Node `json:"body_doc"`
	// CanonOverride lets an AI author touch canon content — set only on
	// explicit user instruction (tenet 5).
	CanonOverride bool `json:"canon_override"`
}

// UpdateEntry applies a patch. Fields touched by a human become canon;
// by AI, draft (ADR 0002). Returns soft-schema warnings (ADR 0004),
// never rejections.
func (t *Tools) UpdateEntry(ctx context.Context, id string, patch EntryPatch, author Author) (Entry, []string, error) {
	eid, err := parseID(id)
	if err != nil {
		return Entry{}, nil, err
	}
	row, err := t.store.Queries.GetEntry(ctx, eid)
	if err != nil {
		return Entry{}, nil, notFound(err)
	}
	et, err := t.store.Queries.GetEntryType(ctx, row.TypeID)
	if err != nil {
		return Entry{}, nil, err
	}

	settings := WorldSettings{}
	if w, err := t.store.Queries.GetWorld(ctx, row.WorldID); err == nil {
		settings = parseSettings(w.Settings)
	}
	aiMayTouchCanon := settings.AICanEditCanon || patch.CanonOverride

	title := row.Title
	if patch.Title != nil && *patch.Title != "" {
		title = *patch.Title
	}

	fields := map[string]FieldValue{}
	if err := json.Unmarshal(row.Fields, &fields); err != nil {
		return Entry{}, nil, fmt.Errorf("bad fields on entry: %w", err)
	}
	touchedStatus := settings.humanStatus()
	if author == AuthorAI {
		touchedStatus = StatusDraft
	}
	if author == AuthorAI && !aiMayTouchCanon {
		var protected []string
		for name, value := range patch.Fields {
			if fv, ok := fields[name]; ok && fv.Status == StatusCanon && value != nil {
				protected = append(protected, name)
			}
		}
		if len(protected) > 0 {
			return Entry{}, nil, fmt.Errorf("canon fields %v are protected: ask the user to permit the edit (canon_override) or promote a different draft", protected)
		}
	}
	for name, value := range patch.Fields {
		if value == nil {
			if fv, ok := fields[name]; ok && fv.Status == StatusCanon && author == AuthorAI && !aiMayTouchCanon {
				return Entry{}, nil, fmt.Errorf("canon field %q cannot be deleted by AI without user permission", name)
			}
			delete(fields, name)
			continue
		}
		fields[name] = FieldValue{Value: value, Status: touchedStatus}
	}

	body := row.Body
	if patch.BodyDoc != nil || patch.BodyMD != nil {
		if author == AuthorAI && !aiMayTouchCanon {
			if existing, err := richtext.ParseDoc(row.Body); err == nil {
				if st := richtext.BodyState(existing); st == "canon" || st == "mixed" {
					return Entry{}, nil, fmt.Errorf("the body contains canon text and is protected: ask the user to permit the edit (canon_override)")
				}
			}
		}
		var doc richtext.Node
		if patch.BodyDoc != nil {
			doc = *patch.BodyDoc
			if err := richtext.Validate(doc); err != nil {
				return Entry{}, nil, err
			}
		} else {
			doc = richtext.FromMarkdown(*patch.BodyMD)
		}
		if author == AuthorAI {
			doc = richtext.MarkAllDraft(doc)
		}
		if body, err = json.Marshal(doc); err != nil {
			return Entry{}, nil, err
		}
	}

	status, err := deriveStatus(fields, body)
	if err != nil {
		return Entry{}, nil, err
	}
	fieldsJSON, err := json.Marshal(fields)
	if err != nil {
		return Entry{}, nil, err
	}

	var updated db.Entry
	err = t.store.Tx(ctx, func(q *db.Queries) error {
		var err error
		updated, err = q.UpdateEntry(ctx, db.UpdateEntryParams{
			ID: eid, Title: title, Fields: fieldsJSON, Body: body, Status: status,
		})
		if err != nil {
			return fmt.Errorf("updating entry: %w", err)
		}
		if err := recordRevision(ctx, q, updated, author); err != nil {
			return err
		}
		if err := t.refreshDerived(ctx, q, updated, et.Name); err != nil {
			return err
		}
		return t.syncMentions(ctx, q, updated, author)
	})
	if err != nil {
		return Entry{}, nil, err
	}

	out, err := t.entryFull(ctx, updated, et.Name)
	return out, schemaWarnings(et, fields), err
}

// CanonScope selects what MarkCanon promotes. Zero value = everything.
type CanonScope struct {
	Fields []string `json:"fields"` // specific fields to promote
	Body   bool     `json:"body"`   // strip draft spans from the body
	Edges  bool     `json:"edges"`  // promote this entry's outgoing edges
}

func (s CanonScope) all() bool { return len(s.Fields) == 0 && !s.Body && !s.Edges }

// MarkCanon promotes the selected parts of an entry — tenet 4's human
// blessing, in bulk or scoped form. Draft spans in the promoted body are
// stripped.
func (t *Tools) MarkCanon(ctx context.Context, id string, scope CanonScope) (Entry, error) {
	eid, err := parseID(id)
	if err != nil {
		return Entry{}, err
	}
	row, err := t.store.Queries.GetEntry(ctx, eid)
	if err != nil {
		return Entry{}, notFound(err)
	}
	et, err := t.store.Queries.GetEntryType(ctx, row.TypeID)
	if err != nil {
		return Entry{}, err
	}

	fields := map[string]FieldValue{}
	if err := json.Unmarshal(row.Fields, &fields); err != nil {
		return Entry{}, err
	}
	promote := func(name string) {
		if fv, ok := fields[name]; ok {
			fv.Status = StatusCanon
			fields[name] = fv
		}
	}
	if scope.all() {
		for name := range fields {
			promote(name)
		}
	} else {
		for _, name := range scope.Fields {
			promote(name)
		}
	}
	fieldsJSON, err := json.Marshal(fields)
	if err != nil {
		return Entry{}, err
	}

	body := row.Body
	if scope.all() || scope.Body {
		doc, err := richtext.ParseDoc(row.Body)
		if err != nil {
			return Entry{}, err
		}
		if body, err = json.Marshal(richtext.StripDraftMarks(doc)); err != nil {
			return Entry{}, err
		}
	}

	status, err := deriveStatus(fields, body)
	if err != nil {
		return Entry{}, err
	}

	var updated db.Entry
	err = t.store.Tx(ctx, func(q *db.Queries) error {
		if scope.all() || scope.Edges {
			if err := q.PromoteEdgesFrom(ctx, eid); err != nil {
				return err
			}
		}
		var err error
		updated, err = q.UpdateEntry(ctx, db.UpdateEntryParams{
			ID: eid, Title: row.Title, Fields: fieldsJSON, Body: body, Status: status,
		})
		if err != nil {
			return err
		}
		if err := recordRevision(ctx, q, updated, AuthorHuman); err != nil {
			return err
		}
		return t.refreshDerived(ctx, q, updated, et.Name)
	})
	if err != nil {
		return Entry{}, err
	}
	return t.entryFull(ctx, updated, et.Name)
}

// DeleteEntry removes an entry (edges cascade). AI may delete drafts
// freely (tenet 5); deleting canon needs the world to allow it or an
// explicit user override.
func (t *Tools) DeleteEntry(ctx context.Context, id string, author Author, canonOverride bool) error {
	eid, err := parseID(id)
	if err != nil {
		return err
	}
	row, err := t.store.Queries.GetEntry(ctx, eid)
	if err != nil {
		return notFound(err)
	}
	if author == AuthorAI && row.Status != StatusDraft {
		settings := WorldSettings{}
		if w, err := t.store.Queries.GetWorld(ctx, row.WorldID); err == nil {
			settings = parseSettings(w.Settings)
		}
		if !settings.AICanEditCanon && !canonOverride {
			return fmt.Errorf("entry %q is %s and protected: only drafts may be deleted by AI without user permission", row.Title, row.Status)
		}
	}
	return t.store.Queries.DeleteEntry(ctx, eid)
}

// RevisionDetail is a full snapshot for the history viewer.
type RevisionDetail struct {
	Revision
	Title  string                `json:"title"`
	Fields map[string]FieldValue `json:"fields"`
	BodyMD string                `json:"body_md"`
}

func (t *Tools) GetRevision(ctx context.Context, revisionID string) (RevisionDetail, error) {
	rid, err := parseID(revisionID)
	if err != nil {
		return RevisionDetail{}, err
	}
	r, err := t.store.Queries.GetRevision(ctx, rid)
	if err != nil {
		return RevisionDetail{}, notFound(err)
	}
	fields := map[string]FieldValue{}
	if err := json.Unmarshal(r.Fields, &fields); err != nil {
		return RevisionDetail{}, err
	}
	doc, err := richtext.ParseDoc(r.Body)
	if err != nil {
		return RevisionDetail{}, err
	}
	return RevisionDetail{
		Revision: Revision{
			ID: idStr(r.ID), Author: r.Author, Status: r.Status,
			CreatedAt: r.CreatedAt.Time,
		},
		Title: r.Title, Fields: fields, BodyMD: richtext.ToMarkdown(doc, true),
	}, nil
}

// RestoreRevision writes a past snapshot back as a new human revision —
// history is append-only (ADR 0011), so restoring never rewrites it.
func (t *Tools) RestoreRevision(ctx context.Context, entryID, revisionID string) (Entry, error) {
	eid, err := parseID(entryID)
	if err != nil {
		return Entry{}, err
	}
	rid, err := parseID(revisionID)
	if err != nil {
		return Entry{}, err
	}
	rev, err := t.store.Queries.GetRevision(ctx, rid)
	if err != nil {
		return Entry{}, notFound(err)
	}
	if rev.EntryID != eid {
		return Entry{}, fmt.Errorf("%w: revision does not belong to entry", ErrNotFound)
	}
	row, err := t.store.Queries.GetEntry(ctx, eid)
	if err != nil {
		return Entry{}, notFound(err)
	}
	et, err := t.store.Queries.GetEntryType(ctx, row.TypeID)
	if err != nil {
		return Entry{}, err
	}

	var updated db.Entry
	err = t.store.Tx(ctx, func(q *db.Queries) error {
		var err error
		updated, err = q.UpdateEntry(ctx, db.UpdateEntryParams{
			ID: eid, Title: rev.Title, Fields: rev.Fields, Body: rev.Body, Status: rev.Status,
		})
		if err != nil {
			return err
		}
		if err := recordRevision(ctx, q, updated, AuthorHuman); err != nil {
			return err
		}
		return t.refreshDerived(ctx, q, updated, et.Name)
	})
	if err != nil {
		return Entry{}, err
	}
	return t.entryFull(ctx, updated, et.Name)
}

func (t *Tools) GetEntry(ctx context.Context, id string) (Entry, error) {
	eid, err := parseID(id)
	if err != nil {
		return Entry{}, err
	}
	row, err := t.store.Queries.GetEntry(ctx, eid)
	if err != nil {
		return Entry{}, notFound(err)
	}
	et, err := t.store.Queries.GetEntryType(ctx, row.TypeID)
	if err != nil {
		return Entry{}, err
	}
	return t.entryFull(ctx, row, et.Name)
}

func (t *Tools) ListEntries(ctx context.Context, worldID string) ([]EntrySummary, error) {
	wid, err := parseID(worldID)
	if err != nil {
		return nil, err
	}
	rows, err := t.store.Queries.ListEntries(ctx, wid)
	if err != nil {
		return nil, err
	}
	out := make([]EntrySummary, 0, len(rows))
	for _, r := range rows {
		out = append(out, EntrySummary{
			ID: idStr(r.ID), Title: r.Title, TypeID: idStr(r.TypeID),
			TypeName: r.TypeName, Status: r.Status,
		})
	}
	return out, nil
}

func (t *Tools) ListRevisions(ctx context.Context, entryID string) ([]Revision, error) {
	eid, err := parseID(entryID)
	if err != nil {
		return nil, err
	}
	rows, err := t.store.Queries.ListRevisions(ctx, eid)
	if err != nil {
		return nil, err
	}
	out := make([]Revision, 0, len(rows))
	for _, r := range rows {
		out = append(out, Revision{
			ID: idStr(r.ID), Author: r.Author, Status: r.Status,
			CreatedAt: r.CreatedAt.Time,
		})
	}
	return out, nil
}

func recordRevision(ctx context.Context, q *db.Queries, e db.Entry, author Author) error {
	_, err := q.CreateRevision(ctx, db.CreateRevisionParams{
		ID: newID(), EntryID: e.ID, Author: string(author),
		Title: e.Title, Fields: e.Fields, Body: e.Body, Status: e.Status,
	})
	if err != nil {
		return fmt.Errorf("recording revision: %w", err)
	}
	return nil
}

// deriveStatus computes entry status from its parts (ADR 0002): canon
// when nothing is draft, draft when everything is, mixed otherwise.
func deriveStatus(fields map[string]FieldValue, body []byte) (string, error) {
	doc, err := richtext.ParseDoc(body)
	if err != nil {
		return "", err
	}
	var draft, canon bool
	switch richtext.BodyState(doc) {
	case "draft":
		draft = true
	case "canon":
		canon = true
	case "mixed":
		draft, canon = true, true
	}
	for _, fv := range fields {
		if fv.Status == StatusDraft {
			draft = true
		} else {
			canon = true
		}
	}
	switch {
	case draft && canon:
		return StatusMixed, nil
	case draft:
		return StatusDraft, nil
	default:
		return StatusCanon, nil
	}
}

// schemaWarnings reports soft-schema drift: fields the schema doesn't
// declare, and declared fields with no value. Advisory only.
func schemaWarnings(et db.EntryType, fields map[string]FieldValue) []string {
	var defs []FieldDef
	if err := json.Unmarshal(et.Fields, &defs); err != nil {
		return nil
	}
	names := make([]string, 0, len(defs))
	for _, d := range defs {
		names = append(names, d.Name)
	}
	var warnings []string
	for name := range fields {
		if !slices.Contains(names, name) {
			warnings = append(warnings, fmt.Sprintf("field %q is not declared on type %s", name, et.Name))
		}
	}
	for _, name := range names {
		if _, ok := fields[name]; !ok {
			warnings = append(warnings, fmt.Sprintf("declared field %q has no value", name))
		}
	}
	return warnings
}

// entryFull is entryOut plus relation and reverse sections — the shape
// every read/write surface returns.
func (t *Tools) entryFull(ctx context.Context, row db.Entry, typeName string) (Entry, error) {
	out, err := entryOut(row, typeName)
	if err != nil {
		return Entry{}, err
	}
	relations, reverse, err := t.relationSections(ctx, row)
	if err != nil {
		return Entry{}, err
	}
	out.Relations = relations
	out.Reverse = reverse
	return out, nil
}

func entryOut(row db.Entry, typeName string) (Entry, error) {
	fields := map[string]FieldValue{}
	if err := json.Unmarshal(row.Fields, &fields); err != nil {
		return Entry{}, fmt.Errorf("bad fields on entry: %w", err)
	}
	doc, err := richtext.ParseDoc(row.Body)
	if err != nil {
		return Entry{}, err
	}
	return Entry{
		ID: idStr(row.ID), WorldID: idStr(row.WorldID), TypeID: idStr(row.TypeID),
		TypeName: typeName, Title: row.Title, Fields: fields,
		BodyMD: richtext.ToMarkdown(doc, true), BodyDoc: doc, Status: row.Status,
		UpdatedAt: row.UpdatedAt.Time,
	}, nil
}
