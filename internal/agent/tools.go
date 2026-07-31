package agent

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"

	"github.com/alextebbs/lore/internal/tools"
)

// The agent's tool set mirrors the MCP surface's query+author tools
// (same tool layer, AuthorAI semantics). mark_canon and restore_revision
// are intentionally absent: promotion is human-gated and the human is
// right here in the UI.

func obj(props map[string]any, required ...string) anthropic.ToolInputSchemaParam {
	return anthropic.ToolInputSchemaParam{Properties: props, Required: required}
}

func str(desc string) map[string]any {
	return map[string]any{"type": "string", "description": desc}
}

func (a *Agent) toolDefs() []anthropic.ToolUnionParam {
	defs := []anthropic.ToolParam{
		{
			Name:        "find_relevant",
			Description: anthropic.String("Hybrid search over the world's entries (lexical + graph proximity + canon weighting). Returns ranked cards. Use before authoring to load context."),
			InputSchema: obj(map[string]any{
				"query":      str("what you're looking for"),
				"canon_only": map[string]any{"type": "boolean", "description": "restrict to canon"},
				"near":       map[string]any{"type": "array", "items": map[string]any{"type": "string"}, "description": "entry ids to boost neighbors of"},
				"limit":      map[string]any{"type": "integer"},
			}, "query"),
		},
		{
			Name:        "list_entries",
			Description: anthropic.String("List all entries in the world (id, title, type, status)."),
			InputSchema: obj(map[string]any{}),
		},
		{
			Name:        "get_entry",
			Description: anthropic.String("Get an entry. detail=card|digest|full (default full: fields, body markdown with {~draft} spans, relations, reverse sections)."),
			InputSchema: obj(map[string]any{
				"entry_id": str("the entry's id"),
				"detail":   str("card, digest, or full"),
			}, "entry_id"),
		},
		{
			Name:        "create_entry",
			Description: anthropic.String("Create a new entry (born DRAFT). Fill content with update_entry afterwards."),
			InputSchema: obj(map[string]any{
				"type_id": str("entry type id (see ENTRY TYPES in context)"),
				"title":   str("title of the new entry"),
			}, "type_id", "title"),
		},
		{
			Name:        "update_entry",
			Description: anthropic.String("Update an entry's title, fields, or body markdown. Your writes become DRAFT. body_md replaces the whole body — include existing canon text unchanged if you're extending it."),
			InputSchema: obj(map[string]any{
				"entry_id": str("the entry's id"),
				"title":    str("new title (optional)"),
				"fields":   map[string]any{"type": "object", "description": "field values to set"},
				"body_md":  str("full replacement body markdown (optional)"),
			}, "entry_id"),
		},
		{
			Name:        "create_edge",
			Description: anthropic.String("Relate two entries through a relation field (born DRAFT). Cardinality-one fields replace the existing edge. annotation is a freeform note like 'Jane is John's older sister'."),
			InputSchema: obj(map[string]any{
				"from_entry_id": str("source entry (owns the relation field)"),
				"field":         str("relation field name on the source's type"),
				"to_entry_id":   str("target entry id"),
				"annotation":    str("freeform note (optional)"),
			}, "from_entry_id", "field", "to_entry_id"),
		},
		{
			Name:        "delete_edge",
			Description: anthropic.String("Delete a DRAFT relation edge. Canon edges require a human."),
			InputSchema: obj(map[string]any{"edge_id": str("the edge's id")}, "edge_id"),
		},
		{
			Name:        "traverse",
			Description: anthropic.String("Ego network around an entry: nodes and typed edges 1-2 hops out."),
			InputSchema: obj(map[string]any{
				"entry_id": str("center entry id"),
				"depth":    map[string]any{"type": "integer", "description": "1 or 2"},
			}, "entry_id"),
		},
	}
	out := make([]anthropic.ToolUnionParam, len(defs))
	for i := range defs {
		out[i] = anthropic.ToolUnionParam{OfTool: &defs[i]}
	}
	return out
}

// execute dispatches a tool call to the tool layer. Errors return as
// agent-legible strings with is_error=true, never as loop failures.
func (a *Agent) execute(ctx context.Context, worldID, name string, input json.RawMessage) (string, bool) {
	res, err := a.dispatch(ctx, worldID, name, input)
	if err != nil {
		return err.Error(), true
	}
	raw, err := json.Marshal(res)
	if err != nil {
		return err.Error(), true
	}
	return string(raw), false
}

func (a *Agent) dispatch(ctx context.Context, worldID, name string, input json.RawMessage) (any, error) {
	switch name {
	case "find_relevant":
		var in struct {
			Query     string   `json:"query"`
			CanonOnly bool     `json:"canon_only"`
			Near      []string `json:"near"`
			Limit     int      `json:"limit"`
		}
		if err := json.Unmarshal(input, &in); err != nil {
			return nil, err
		}
		return a.tools.FindRelevant(ctx, worldID, in.Query, in.CanonOnly, in.Near, in.Limit)
	case "list_entries":
		return a.tools.ListEntries(ctx, worldID)
	case "get_entry":
		var in struct {
			EntryID string `json:"entry_id"`
			Detail  string `json:"detail"`
		}
		if err := json.Unmarshal(input, &in); err != nil {
			return nil, err
		}
		switch in.Detail {
		case "card":
			card, _, err := a.tools.Serializations(ctx, in.EntryID)
			return map[string]string{"card": card}, err
		case "digest":
			_, digest, err := a.tools.Serializations(ctx, in.EntryID)
			return map[string]string{"digest": digest}, err
		}
		e, err := a.tools.GetEntry(ctx, in.EntryID)
		if err != nil {
			return nil, err
		}
		return agentEntryView(e), nil
	case "create_entry":
		var in struct {
			TypeID string `json:"type_id"`
			Title  string `json:"title"`
		}
		if err := json.Unmarshal(input, &in); err != nil {
			return nil, err
		}
		e, err := a.tools.CreateEntry(ctx, worldID, in.TypeID, in.Title, tools.AuthorAI)
		if err != nil {
			return nil, err
		}
		return agentEntryView(e), nil
	case "update_entry":
		var in struct {
			EntryID string         `json:"entry_id"`
			Title   *string        `json:"title"`
			Fields  map[string]any `json:"fields"`
			BodyMD  *string        `json:"body_md"`
		}
		if err := json.Unmarshal(input, &in); err != nil {
			return nil, err
		}
		e, warnings, err := a.tools.UpdateEntry(ctx, in.EntryID, tools.EntryPatch{
			Title: in.Title, Fields: in.Fields, BodyMD: in.BodyMD,
		}, tools.AuthorAI)
		if err != nil {
			return nil, err
		}
		return map[string]any{"entry": agentEntryView(e), "warnings": warnings}, nil
	case "create_edge":
		var in struct {
			FromEntryID string `json:"from_entry_id"`
			Field       string `json:"field"`
			ToEntryID   string `json:"to_entry_id"`
			Annotation  string `json:"annotation"`
		}
		if err := json.Unmarshal(input, &in); err != nil {
			return nil, err
		}
		edge, warnings, err := a.tools.CreateEdge(ctx, in.FromEntryID, in.Field, in.ToEntryID, in.Annotation, tools.AuthorAI)
		if err != nil {
			return nil, err
		}
		return map[string]any{"edge": edge, "warnings": warnings}, nil
	case "delete_edge":
		var in struct {
			EdgeID string `json:"edge_id"`
		}
		if err := json.Unmarshal(input, &in); err != nil {
			return nil, err
		}
		if err := a.tools.DeleteEdge(ctx, in.EdgeID, tools.AuthorAI); err != nil {
			return nil, err
		}
		return map[string]bool{"deleted": true}, nil
	case "traverse":
		var in struct {
			EntryID string `json:"entry_id"`
			Depth   int    `json:"depth"`
		}
		if err := json.Unmarshal(input, &in); err != nil {
			return nil, err
		}
		return a.tools.Traverse(ctx, in.EntryID, in.Depth)
	}
	return nil, fmt.Errorf("unknown tool %q", name)
}

// agentEntryView strips body_doc (markdown at the boundary, ADR 0001).
func agentEntryView(e tools.Entry) map[string]any {
	return map[string]any{
		"id": e.ID, "type_id": e.TypeID, "type_name": e.TypeName,
		"title": e.Title, "fields": e.Fields, "body_md": e.BodyMD,
		"status": e.Status, "relations": e.Relations, "reverse": e.Reverse,
	}
}
