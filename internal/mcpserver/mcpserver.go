// Package mcpserver exposes the tool layer over MCP (SPEC tenet 2):
// every capability, one MCP tool, same functions the HTTP API adapts.
// MCP callers are AI agents acting for the token's owner, so writes use
// AuthorAI and land as draft (tenet 4); canon promotion tools exist but
// are documented as human-instruction-only (tenet 5).
package mcpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/alextebbs/lore/internal/export"
	"github.com/alextebbs/lore/internal/toolreg"
	"github.com/alextebbs/lore/internal/tools"
)

const instructions = `Lore is a TTRPG worldbuilding tool. Content has draft/canon status:
your writes always land as DRAFT; a human promotes them to canon. Rich
text is Markdown where {~draft}...{/~} marks draft spans (your authored
text is auto-marked). [[Entry Title]] anywhere in body or rich-text
fields links entries and auto-creates "mentioned in" relations (links follow
renames automatically). Every entry also accepts untyped edges via the
"related" field — use it when no declared relation fits. Worlds
carry settings (vibe, style_prompt, authoring policies) and a meta World
entry describing the setting — read both before writing, and match the
world's voice. Canon is protected: if a world's ai_can_edit_canon is
false, editing canon requires canon_override=true, which you may set
ONLY on explicit user instruction — and even when the world allows it,
treat canon edits with care and prefer proposing drafts. Only call
mark_canon, restore_revision, or delete_world when the user explicitly
asks.`

// entryView is the MCP-facing entry shape: markdown at the boundary
// (ADR 0001) — the structured body_doc stays internal, which also keeps
// the JSON schema non-recursive for the SDK's inference.
type entryView struct {
	ID        string                      `json:"id"`
	WorldID   string                      `json:"world_id"`
	TypeID    string                      `json:"type_id"`
	TypeName  string                      `json:"type_name"`
	Title     string                      `json:"title"`
	Fields    map[string]tools.FieldValue `json:"fields"`
	BodyMD    string                      `json:"body_md"`
	Status    string                      `json:"status"`
	Relations []tools.RelationSection     `json:"relations,omitempty"`
}

func view(e tools.Entry) entryView {
	return entryView{
		ID: e.ID, WorldID: e.WorldID, TypeID: e.TypeID, TypeName: e.TypeName,
		Title: e.Title, Fields: e.Fields, BodyMD: e.BodyMD, Status: e.Status,
		Relations: e.Relations,
	}
}

// addTool registers and records — New asserts the recorded set matches
// the tool registry (ADR 0016) so surface drift fails at startup.
func addTool[In, Out any](s *mcp.Server, registered *[]string, t *mcp.Tool, h mcp.ToolHandlerFor[In, Out]) {
	*registered = append(*registered, t.Name)
	mcp.AddTool(s, t, h)
}

func New(t *tools.Tools) *mcp.Server {
	var registered []string
	s := mcp.NewServer(&mcp.Implementation{
		Name:    "lore",
		Title:   "Lore Worldbuilding",
		Version: "0.1.0",
	}, &mcp.ServerOptions{Instructions: instructions})

	type worldID struct {
		WorldID string `json:"world_id" jsonschema:"the world's id"`
	}
	type entryID struct {
		EntryID string `json:"entry_id" jsonschema:"the entry's id"`
	}

	addTool(s, &registered, &mcp.Tool{
		Name:        "list_worlds",
		Description: "List all worlds you can access.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, _ any) (*mcp.CallToolResult, []tools.World, error) {
		out, err := t.ListWorlds(ctx)
		return nil, out, err
	})

	type createWorldIn struct {
		Name string `json:"name" jsonschema:"name of the new world"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "create_world",
		Description: "Create a new world, seeded with the built-in entry types (Character, Place, Event, Item, Faction).",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in createWorldIn) (*mcp.CallToolResult, tools.World, error) {
		out, err := t.CreateWorld(ctx, in.Name)
		return nil, out, err
	})

	type worldOut struct {
		World tools.World       `json:"world"`
		Types []tools.EntryType `json:"types"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "get_world",
		Description: "Get a world and its entry types (with effective fields, including relation field configs).",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in worldID) (*mcp.CallToolResult, worldOut, error) {
		w, err := t.GetWorld(ctx, in.WorldID)
		if err != nil {
			return nil, worldOut{}, err
		}
		types, err := t.ListTypes(ctx, in.WorldID)
		return nil, worldOut{World: w, Types: types}, err
	})

	addTool(s, &registered, &mcp.Tool{
		Name:        "list_entries",
		Description: "List all entries in a world (id, title, type, draft/canon status).",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in worldID) (*mcp.CallToolResult, []tools.EntrySummary, error) {
		out, err := t.ListEntries(ctx, in.WorldID)
		return nil, out, err
	})

	type createEntryIn struct {
		WorldID string `json:"world_id" jsonschema:"the world's id"`
		TypeID  string `json:"type_id" jsonschema:"the entry type's id (see get_world)"`
		Title   string `json:"title" jsonschema:"title of the new entry"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "create_entry",
		Description: "Create a new entry. It is born as DRAFT until a human promotes it. Fill content with update_entry afterwards.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in createEntryIn) (*mcp.CallToolResult, entryView, error) {
		out, err := t.CreateEntry(ctx, in.WorldID, in.TypeID, in.Title, tools.AuthorAI)
		return nil, view(out), err
	})

	type getEntryIn struct {
		EntryID string `json:"entry_id" jsonschema:"the entry's id"`
		Detail  string `json:"detail,omitempty" jsonschema:"card (one line), digest (paragraph), or full (default). Use card/digest to save tokens."`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "get_entry",
		Description: "Get an entry. detail=full (default) returns fields with statuses, body markdown ({~draft} spans), and a unified relations list (sections with reverse=true group edges pointing at this entry); card/digest return compact summaries at lower token cost.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in getEntryIn) (*mcp.CallToolResult, any, error) {
		switch in.Detail {
		case "card":
			card, _, err := t.Serializations(ctx, in.EntryID)
			return nil, map[string]string{"id": in.EntryID, "card": card}, err
		case "digest":
			_, digest, err := t.Serializations(ctx, in.EntryID)
			return nil, map[string]string{"id": in.EntryID, "digest": digest}, err
		default:
			out, err := t.GetEntry(ctx, in.EntryID)
			return nil, view(out), err
		}
	})

	type findRelevantIn struct {
		WorldID   string   `json:"world_id" jsonschema:"the world's id"`
		Query     string   `json:"query" jsonschema:"what you're looking for, natural language or names"`
		CanonOnly bool     `json:"canon_only,omitempty" jsonschema:"restrict to established canon facts"`
		Near      []string `json:"near,omitempty" jsonschema:"entry ids to boost graph neighbors of (e.g. the entry being discussed)"`
		Limit     int      `json:"limit,omitempty" jsonschema:"max results, default 10"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "find_relevant",
		Description: "THE search tool: hybrid ranking (lexical + semantic when available + graph proximity + canon weighting) over a world's entries. Returns cards with scores. Call before authoring to load relevant context.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in findRelevantIn) (*mcp.CallToolResult, []tools.SearchResult, error) {
		out, err := t.FindRelevant(ctx, in.WorldID, in.Query, in.CanonOnly, in.Near, in.Limit)
		return nil, out, err
	})

	type updateEntryIn struct {
		EntryID       string         `json:"entry_id" jsonschema:"the entry's id"`
		Title         *string        `json:"title,omitempty" jsonschema:"new title (optional)"`
		Fields        map[string]any `json:"fields,omitempty" jsonschema:"field values to set; null value deletes a field"`
		BodyMD        *string        `json:"body_md,omitempty" jsonschema:"full replacement body markdown; your text will be marked draft. Use [[Entry Title]] to link entries"`
		CanonOverride bool           `json:"canon_override,omitempty" jsonschema:"permit touching canon content — set ONLY when the user explicitly ordered this edit"`
	}
	type updateEntryOut struct {
		Entry    entryView `json:"entry"`
		Warnings []string  `json:"warnings,omitempty"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "update_entry",
		Description: "Update an entry's title, fields, or body. Everything you write becomes DRAFT. Canon spans you resend are preserved as canon only if unchanged... they are re-marked draft, so prefer minimal edits. Soft-schema warnings are advisory.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in updateEntryIn) (*mcp.CallToolResult, updateEntryOut, error) {
		out, warnings, err := t.UpdateEntry(ctx, in.EntryID, tools.EntryPatch{
			Title: in.Title, Fields: in.Fields, BodyMD: in.BodyMD,
			CanonOverride: in.CanonOverride,
		}, tools.AuthorAI)
		return nil, updateEntryOut{Entry: view(out), Warnings: warnings}, err
	})

	type markCanonIn struct {
		EntryID string   `json:"entry_id" jsonschema:"the entry's id"`
		Fields  []string `json:"fields,omitempty" jsonschema:"only these fields (optional)"`
		Body    bool     `json:"body,omitempty" jsonschema:"promote the body's draft spans"`
		Edges   bool     `json:"edges,omitempty" jsonschema:"promote the entry's outgoing edges"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "mark_canon",
		Description: "HUMAN-GATED: promote draft content to canon. Call ONLY when the user explicitly instructs promotion. Empty scope promotes everything in the entry.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in markCanonIn) (*mcp.CallToolResult, entryView, error) {
		out, err := t.MarkCanon(ctx, in.EntryID, tools.CanonScope{
			Fields: in.Fields, Body: in.Body, Edges: in.Edges,
		})
		return nil, view(out), err
	})

	addTool(s, &registered, &mcp.Tool{
		Name:        "list_revisions",
		Description: "List an entry's revision history (author human/ai, status, timestamp).",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in entryID) (*mcp.CallToolResult, []tools.Revision, error) {
		out, err := t.ListRevisions(ctx, in.EntryID)
		return nil, out, err
	})

	type revisionIn struct {
		RevisionID string `json:"revision_id" jsonschema:"the revision's id"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "get_revision",
		Description: "Get a full revision snapshot (title, fields, body markdown).",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in revisionIn) (*mcp.CallToolResult, tools.RevisionDetail, error) {
		out, err := t.GetRevision(ctx, in.RevisionID)
		return nil, out, err
	})

	type restoreIn struct {
		EntryID    string `json:"entry_id" jsonschema:"the entry's id"`
		RevisionID string `json:"revision_id" jsonschema:"the revision to restore"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "restore_revision",
		Description: "HUMAN-GATED: restore an entry to a past revision. Call ONLY when the user explicitly instructs it. History is append-only; restoring adds a new revision.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in restoreIn) (*mcp.CallToolResult, entryView, error) {
		out, err := t.RestoreRevision(ctx, in.EntryID, in.RevisionID)
		return nil, view(out), err
	})

	type createEdgeIn struct {
		FromEntryID string `json:"from_entry_id" jsonschema:"source entry id (owns the relation field)"`
		Field       string `json:"field" jsonschema:"relation field name on the source entry's type"`
		ToEntryID   string `json:"to_entry_id" jsonschema:"target entry id"`
		Annotation  string `json:"annotation,omitempty" jsonschema:"freeform note, e.g. 'Jane is John's older sister'"`
	}
	type createEdgeOut struct {
		Edge     tools.Edge `json:"edge"`
		Warnings []string   `json:"warnings,omitempty"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "create_edge",
		Description: "Relate two entries through a relation field. Your edges are born DRAFT. Cardinality-one fields replace the existing edge. Warnings are advisory (soft schema).",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in createEdgeIn) (*mcp.CallToolResult, createEdgeOut, error) {
		edge, warnings, err := t.CreateEdge(ctx, in.FromEntryID, in.Field, in.ToEntryID, in.Annotation, tools.AuthorAI)
		return nil, createEdgeOut{Edge: edge, Warnings: warnings}, err
	})

	type edgeIDIn struct {
		EdgeID string `json:"edge_id" jsonschema:"the edge's id"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "delete_edge",
		Description: "Delete a relation edge. You may only delete DRAFT edges; canon edges require a human.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in edgeIDIn) (*mcp.CallToolResult, any, error) {
		err := t.DeleteEdge(ctx, in.EdgeID, tools.AuthorAI)
		return nil, map[string]bool{"deleted": err == nil}, err
	})

	type edgeStatusIn struct {
		EdgeID string `json:"edge_id" jsonschema:"the edge's id"`
		Status string `json:"status" jsonschema:"draft or canon"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "update_edge_status",
		Description: "Promote or demote a single relation edge (draft/canon). You may not modify canon edges unless world policy allows it.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in edgeStatusIn) (*mcp.CallToolResult, tools.Edge, error) {
		out, err := t.UpdateEdgeStatus(ctx, in.EdgeID, in.Status, tools.AuthorAI)
		return nil, out, err
	})

	type trayIn struct {
		WorldID        string `json:"world_id" jsonschema:"the world's id"`
		CurrentEntryID string `json:"current_entry_id,omitempty" jsonschema:"entry currently being discussed (optional)"`
		Query          string `json:"query,omitempty" jsonschema:"topic to auto-retrieve relevant entries for (optional)"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "get_context_tray",
		Description: "Get the user's persistent context tray for a world: pinned entries, the current entry, and auto-retrieved items, each with serialized text and token estimates. Call before authoring to load the user's working set.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in trayIn) (*mcp.CallToolResult, tools.Tray, error) {
		out, err := t.GetContextTray(ctx, in.WorldID, in.CurrentEntryID, in.Query, nil)
		return nil, out, err
	})

	type pinIn struct {
		WorldID       string `json:"world_id" jsonschema:"the world's id"`
		EntryID       string `json:"entry_id" jsonschema:"entry to pin"`
		WithNeighbors bool   `json:"with_neighbors,omitempty" jsonschema:"also include the entry's graph neighbors"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "pin_entry",
		Description: "Pin an entry to the user's context tray (persists across sessions and surfaces).",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in pinIn) (*mcp.CallToolResult, any, error) {
		err := t.PinEntry(ctx, in.WorldID, in.EntryID, in.WithNeighbors)
		return nil, map[string]bool{"pinned": err == nil}, err
	})

	type unpinIn struct {
		WorldID string `json:"world_id" jsonschema:"the world's id"`
		EntryID string `json:"entry_id" jsonschema:"entry to unpin"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "unpin_entry",
		Description: "Remove an entry from the user's context tray.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in unpinIn) (*mcp.CallToolResult, any, error) {
		err := t.UnpinEntry(ctx, in.WorldID, in.EntryID)
		return nil, map[string]bool{"unpinned": err == nil}, err
	})

	type traverseIn struct {
		EntryID string `json:"entry_id" jsonschema:"center of the ego network"`
		Depth   int    `json:"depth,omitempty" jsonschema:"hops out from the entry, 1 or 2 (default 1)"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "traverse",
		Description: "Get the ego network around an entry: nodes and typed edges 1-2 hops out. Use to load related context before authoring.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in traverseIn) (*mcp.CallToolResult, tools.Graph, error) {
		out, err := t.Traverse(ctx, in.EntryID, in.Depth)
		return nil, out, err
	})

	type createTypeIn struct {
		WorldID  string           `json:"world_id" jsonschema:"the world's id"`
		Name     string           `json:"name" jsonschema:"name of the new entry type"`
		ParentID string           `json:"parent_id,omitempty" jsonschema:"parent type id for single inheritance (optional)"`
		Fields   []tools.FieldDef `json:"fields" jsonschema:"field definitions; kind: string|number|date|richtext|relation; relation fields take a relation config (targets, many, template, inverse_label, annotations)"`
	}
	type createTypeOut struct {
		Type     tools.EntryType `json:"type"`
		Warnings []string        `json:"warnings,omitempty"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "create_entry_type",
		Description: "Define a new entry type (schema) in a world, optionally inheriting from a parent type. Soft-validated: warnings, not rejections.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in createTypeIn) (*mcp.CallToolResult, createTypeOut, error) {
		et, warnings, err := t.CreateEntryType(ctx, in.WorldID, in.Name, in.ParentID, in.Fields)
		return nil, createTypeOut{Type: et, Warnings: warnings}, err
	})

	type updateTypeIn struct {
		WorldID string            `json:"world_id" jsonschema:"the world's id"`
		TypeID  string            `json:"type_id" jsonschema:"the entry type to edit"`
		Name    string            `json:"name,omitempty" jsonschema:"new type name (optional)"`
		Fields  []tools.FieldDef  `json:"fields,omitempty" jsonschema:"replacement field list (optional; omit to keep)"`
		Renames map[string]string `json:"renames,omitempty" jsonschema:"old field name -> new field name; existing edges and field values migrate automatically"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "update_entry_type",
		Description: "Edit an entry type: rename it, replace fields, and rename fields with automatic migration of edges and stored values (type + subtypes).",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in updateTypeIn) (*mcp.CallToolResult, createTypeOut, error) {
		et, warnings, err := t.UpdateEntryType(ctx, in.WorldID, in.TypeID, in.Name, in.Fields, in.Renames)
		return nil, createTypeOut{Type: et, Warnings: warnings}, err
	})

	addTool(s, &registered, &mcp.Tool{
		Name:        "dump_world",
		Description: "Export a world as a full-fidelity fixture (JSON string): types, entries with statuses and draft marks, edges with annotations. Re-importable via import_world.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in worldID) (*mcp.CallToolResult, any, error) {
		dump, err := t.DumpWorld(ctx, in.WorldID)
		if err != nil {
			return nil, nil, err
		}
		raw, err := json.Marshal(dump)
		return nil, map[string]string{"dump_json": string(raw)}, err
	})

	type importIn struct {
		Name        string `json:"name,omitempty" jsonschema:"name for the imported world (defaults to the dump's name)"`
		DumpJSON    string `json:"dump_json" jsonschema:"a fixture produced by dump_world"`
		PreserveIDs bool   `json:"preserve_ids,omitempty" jsonschema:"keep dumped ids verbatim (prod swap); delete the old world first"`
	}
	type vaultImportIn struct {
		WorldID string            `json:"world_id" jsonschema:"the world to import into"`
		Files   []tools.VaultFile `json:"files" jsonschema:"markdown files: path + content; frontmatter type/status honored, [[wiki-links]] become mentions"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "import_vault",
		Description: "Import Obsidian-style markdown files as entries in an existing world (additive; existing titles are skipped). Entries without status frontmatter arrive as DRAFT.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in vaultImportIn) (*mcp.CallToolResult, tools.VaultImportResult, error) {
		out, err := t.ImportVault(ctx, in.WorldID, in.Files)
		return nil, out, err
	})

	addTool(s, &registered, &mcp.Tool{
		Name:        "import_world",
		Description: "Rebuild a world from a dump_world fixture. IDs are remapped; statuses, draft marks, and annotations come through verbatim.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in importIn) (*mcp.CallToolResult, tools.World, error) {
		var dump tools.WorldDump
		if err := json.Unmarshal([]byte(in.DumpJSON), &dump); err != nil {
			return nil, tools.World{}, fmt.Errorf("bad dump json: %w", err)
		}
		out, err := t.ImportWorld(ctx, dump, in.Name, in.PreserveIDs)
		return nil, out, err
	})

	type settingsIn struct {
		WorldID  string              `json:"world_id" jsonschema:"the world's id"`
		Settings tools.WorldSettings `json:"settings" jsonschema:"vibe (world context), style_prompt (writer priming), humans_author_as (draft|canon), ai_can_edit_canon"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "update_world_settings",
		Description: "Replace a world's settings: vibe/context prompt, writing-style primer, and authoring policies (humans_author_as, ai_can_edit_canon).",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in settingsIn) (*mcp.CallToolResult, tools.World, error) {
		out, err := t.UpdateWorldSettings(ctx, in.WorldID, in.Settings)
		return nil, out, err
	})

	type deleteEntryIn struct {
		EntryID       string `json:"entry_id" jsonschema:"the entry's id"`
		CanonOverride bool   `json:"canon_override,omitempty" jsonschema:"permit deleting canon — ONLY on explicit user instruction"`
	}
	addTool(s, &registered, &mcp.Tool{
		Name:        "delete_entry",
		Description: "Delete an entry and its relations. You may freely delete DRAFT entries; canon needs the world's permission or explicit user instruction.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in deleteEntryIn) (*mcp.CallToolResult, any, error) {
		err := t.DeleteEntry(ctx, in.EntryID, tools.AuthorAI, in.CanonOverride)
		return nil, map[string]bool{"deleted": err == nil}, err
	})

	addTool(s, &registered, &mcp.Tool{
		Name:        "delete_world",
		Description: "HUMAN-GATED: permanently delete a world and everything in it. Call ONLY when the user explicitly instructs it, naming the world.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in worldID) (*mcp.CallToolResult, any, error) {
		err := t.DeleteWorld(ctx, in.WorldID)
		return nil, map[string]bool{"deleted": err == nil}, err
	})

	addTool(s, &registered, &mcp.Tool{
		Name:        "export_entry",
		Description: "Export one entry as clean vault Markdown (frontmatter, [[wikilinks]], draft markers stripped).",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in entryID) (*mcp.CallToolResult, any, error) {
		e, err := t.GetEntry(ctx, in.EntryID)
		if err != nil {
			return nil, nil, err
		}
		return nil, map[string]string{"markdown": export.RenderEntry(e)}, nil
	})

	addTool(s, &registered, &mcp.Tool{
		Name:        "export_world",
		Description: "Export a whole world as an Obsidian-style vault: a list of {path, content} Markdown files, folders per type.",
	}, func(ctx context.Context, req *mcp.CallToolRequest, in worldID) (*mcp.CallToolResult, []export.File, error) {
		files, err := export.BuildVault(ctx, t, in.WorldID)
		return nil, files, err
	})

	declared := toolreg.MCPNames()
	seen := map[string]bool{}
	for _, name := range registered {
		if !declared[name] {
			panic(fmt.Sprintf("mcp tool %q is not in the tool registry (internal/toolreg)", name))
		}
		seen[name] = true
	}
	for name := range declared {
		if !seen[name] {
			panic(fmt.Sprintf("tool registry declares MCP tool %q but it is not registered", name))
		}
	}
	return s
}

// Handler wraps the MCP server as a streamable-HTTP handler with
// optional static bearer-token auth (placeholder until real per-user
// tokens; M1 deferred by user decision).
func Handler(t *tools.Tools, token string) http.Handler {
	s := New(t)
	h := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return s }, nil)
	if token == "" {
		return h
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+token {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		h.ServeHTTP(w, r)
	})
}
