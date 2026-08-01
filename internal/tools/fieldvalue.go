package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alextebbs/lore/internal/richtext"
	"github.com/alextebbs/lore/internal/store/db"
)

// Fields-as-docs (ADR 0014): richtext and richtext_list field values
// store structured docs, exactly like bodies — one content model, one
// mention pipeline. The write boundary accepts markdown strings or doc
// objects and normalizes to docs; the read boundary emits the readable
// markdown in FieldValue.Value (so MCP/agent consumers keep working)
// plus the doc in FieldValue.ValueDoc for structured editors. Legacy
// string values still render and sync until their next write migrates
// them.

// asDoc reports whether a decoded field value is a rich-text doc.
func asDoc(v any) (richtext.Node, bool) {
	m, ok := v.(map[string]any)
	if !ok || m["type"] != "doc" {
		return richtext.Node{}, false
	}
	raw, err := json.Marshal(m)
	if err != nil {
		return richtext.Node{}, false
	}
	doc, err := richtext.ParseDoc(raw)
	if err != nil || richtext.Validate(doc) != nil {
		return richtext.Node{}, false
	}
	return doc, true
}

// fieldValueText renders any field value as readable text: docs via
// the markdown boundary, lists joined, scalars verbatim.
func fieldValueText(v any) string {
	if doc, ok := asDoc(v); ok {
		return richtext.ToMarkdown(doc, false)
	}
	switch vv := v.(type) {
	case richtext.Node:
		return richtext.ToMarkdown(vv, false)
	case []any:
		var parts []string
		for _, item := range vv {
			if s := fieldValueText(item); s != "" {
				parts = append(parts, s)
			}
		}
		return strings.Join(parts, "; ")
	case nil:
		return ""
	}
	s := fmt.Sprintf("%v", v)
	if s == "<nil>" {
		return ""
	}
	return s
}

// coerceDocValue normalizes one richtext value (markdown string or doc
// object) to a mention-resolved doc.
func (t *Tools) coerceDocValue(ctx context.Context, q *db.Queries, worldID pgtype.UUID, v any) any {
	if doc, ok := asDoc(v); ok {
		return t.resolveMentionDoc(ctx, q, worldID, doc)
	}
	s, _ := v.(string)
	return t.resolveMentionDoc(ctx, q, worldID, richtext.FromMarkdown(s))
}

// coerceFieldValue normalizes an incoming field value by declared kind.
func (t *Tools) coerceFieldValue(ctx context.Context, q *db.Queries, worldID pgtype.UUID, kind string, v any) any {
	switch kind {
	case "richtext":
		return t.coerceDocValue(ctx, q, worldID, v)
	case "richtext_list":
		items, ok := v.([]any)
		if !ok {
			if s, isStr := v.(string); isStr && s != "" {
				items = []any{s}
			}
		}
		out := make([]any, 0, len(items))
		for _, item := range items {
			out = append(out, t.coerceDocValue(ctx, q, worldID, item))
		}
		return out
	default:
		// Undeclared fields that arrive doc-shaped still get their
		// mentions resolved (soft schema).
		if doc, ok := asDoc(v); ok {
			return t.resolveMentionDoc(ctx, q, worldID, doc)
		}
		return v
	}
}

// presentFieldValue splits a stored value into the readable form and
// the structured form for output.
func presentFieldValue(v any) (value any, valueDoc any) {
	if doc, ok := asDoc(v); ok {
		return richtext.ToMarkdown(doc, true), doc
	}
	if list, ok := v.([]any); ok {
		docs := make([]any, 0, len(list))
		mds := make([]any, 0, len(list))
		anyDoc := false
		for _, item := range list {
			if doc, ok := asDoc(item); ok {
				anyDoc = true
				docs = append(docs, doc)
				mds = append(mds, richtext.ToMarkdown(doc, true))
			} else {
				docs = append(docs, nil)
				mds = append(mds, item)
			}
		}
		if anyDoc {
			return mds, docs
		}
	}
	return v, nil
}
