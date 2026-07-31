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

	status := StatusCanon
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
		return recordRevision(ctx, q, row, author)
	})
	if err != nil {
		return Entry{}, err
	}
	return entryOut(row, et.Name)
}

// EntryPatch carries partial updates; nil means "leave unchanged".
// BodyDoc takes precedence over BodyMD when both are set.
type EntryPatch struct {
	Title   *string        `json:"title"`
	Fields  map[string]any `json:"fields"` // value nil deletes the field
	BodyMD  *string        `json:"body_md"`
	BodyDoc *richtext.Node `json:"body_doc"`
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

	title := row.Title
	if patch.Title != nil && *patch.Title != "" {
		title = *patch.Title
	}

	fields := map[string]FieldValue{}
	if err := json.Unmarshal(row.Fields, &fields); err != nil {
		return Entry{}, nil, fmt.Errorf("bad fields on entry: %w", err)
	}
	touchedStatus := StatusCanon
	if author == AuthorAI {
		touchedStatus = StatusDraft
	}
	for name, value := range patch.Fields {
		if value == nil {
			delete(fields, name)
			continue
		}
		fields[name] = FieldValue{Value: value, Status: touchedStatus}
	}

	body := row.Body
	if patch.BodyDoc != nil || patch.BodyMD != nil {
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
		return recordRevision(ctx, q, updated, author)
	})
	if err != nil {
		return Entry{}, nil, err
	}

	out, err := entryOut(updated, et.Name)
	return out, schemaWarnings(et, fields), err
}

// CanonScope selects what MarkCanon promotes. Zero value = everything.
type CanonScope struct {
	Fields []string `json:"fields"` // specific fields to promote
	Body   bool     `json:"body"`   // strip draft spans from the body
}

func (s CanonScope) all() bool { return len(s.Fields) == 0 && !s.Body }

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
		var err error
		updated, err = q.UpdateEntry(ctx, db.UpdateEntryParams{
			ID: eid, Title: row.Title, Fields: fieldsJSON, Body: body, Status: status,
		})
		if err != nil {
			return err
		}
		return recordRevision(ctx, q, updated, AuthorHuman)
	})
	if err != nil {
		return Entry{}, err
	}
	return entryOut(updated, et.Name)
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
		return recordRevision(ctx, q, updated, AuthorHuman)
	})
	if err != nil {
		return Entry{}, err
	}
	return entryOut(updated, et.Name)
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
	return entryOut(row, et.Name)
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
