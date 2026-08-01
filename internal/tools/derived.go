package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/alextebbs/lore/internal/richtext"
	"github.com/alextebbs/lore/internal/store/db"
)

// Derived serializations (ADR 0010): every entry renders at three sizes.
// Cards and digests are cached derived data outside draft/canon,
// regenerated transactionally with each write. v0 generation is
// deterministic; AI-written digests can replace it later without schema
// changes.

// buildDerived renders card, digest, and search_text for an entry row.
func buildDerived(row db.Entry, typeName string, edges []db.ListEdgesFromRow) (card, digest, searchText string) {
	fields := map[string]FieldValue{}
	_ = json.Unmarshal(row.Fields, &fields)

	var fieldBits []string
	var fieldText []string
	for name, fv := range fields {
		v := fieldValueText(fv.Value)
		if v == "" {
			continue
		}
		fieldBits = append(fieldBits, name+": "+v)
		fieldText = append(fieldText, v)
	}

	doc, err := richtext.ParseDoc(row.Body)
	var bodyPlain string
	if err == nil {
		bodyPlain = richtext.ToMarkdown(doc, false)
	}
	bodyWords := strings.Fields(bodyPlain)

	card = fmt.Sprintf("%s (%s, %s)", row.Title, typeName, row.Status)
	if len(fieldBits) > 0 {
		card += " — " + strings.Join(fieldBits, "; ")
	}
	if len(bodyWords) > 0 {
		head := bodyWords
		if len(head) > 25 {
			head = head[:25]
		}
		card += ". " + strings.Join(head, " ")
		if len(bodyWords) > 25 {
			card += "…"
		}
	}

	digest = card
	if len(bodyWords) > 25 {
		head := bodyWords
		if len(head) > 120 {
			head = head[:120]
		}
		digest = fmt.Sprintf("%s (%s, %s)", row.Title, typeName, row.Status)
		if len(fieldBits) > 0 {
			digest += " — " + strings.Join(fieldBits, "; ")
		}
		digest += "\n\n" + strings.Join(head, " ")
		if len(bodyWords) > 120 {
			digest += "…"
		}
	}
	if len(edges) > 0 {
		var rels []string
		for _, e := range edges {
			r := e.Field + " → " + e.ToTitle
			if e.Annotation != "" {
				r += " (" + e.Annotation + ")"
			}
			rels = append(rels, r)
		}
		digest += "\nRelations: " + strings.Join(rels, "; ")
	}

	searchText = row.Title + " " + typeName + " " +
		strings.Join(fieldText, " ") + " " + bodyPlain
	return card, digest, searchText
}

// refreshDerived recomputes an entry's derived row inside the caller's
// transaction (or plain queries).
func (t *Tools) refreshDerived(ctx context.Context, q *db.Queries, e db.Entry, typeName string) error {
	edges, err := q.ListEdgesFrom(ctx, e.ID)
	if err != nil {
		return err
	}
	card, digest, searchText := buildDerived(e, typeName, edges)
	if err := q.UpsertDerived(ctx, db.UpsertDerivedParams{
		EntryID: e.ID, Card: card, Digest: digest, SearchText: searchText,
	}); err != nil {
		return fmt.Errorf("refreshing derived: %w", err)
	}
	if t.embedder != nil {
		t.embedder.EnqueueEntry(idStr(e.ID), card)
	}
	return nil
}

// Serializations returns the card and digest for an entry.
func (t *Tools) Serializations(ctx context.Context, entryID string) (card, digest string, err error) {
	eid, err := parseID(entryID)
	if err != nil {
		return "", "", err
	}
	d, err := t.store.Queries.GetDerived(ctx, eid)
	if err == nil {
		return d.Card, d.Digest, nil
	}
	// Lazily backfill entries written before derived rows existed.
	row, err := t.store.Queries.GetEntry(ctx, eid)
	if err != nil {
		return "", "", notFound(err)
	}
	et, err := t.store.Queries.GetEntryType(ctx, row.TypeID)
	if err != nil {
		return "", "", err
	}
	if err := t.refreshDerived(ctx, t.store.Queries, row, et.Name); err != nil {
		return "", "", err
	}
	d, err = t.store.Queries.GetDerived(ctx, eid)
	if err != nil {
		return "", "", err
	}
	return d.Card, d.Digest, nil
}
