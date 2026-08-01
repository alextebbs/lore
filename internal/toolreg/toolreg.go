// Package toolreg is the single declaration of the tool surface
// (ADR 0016). One row per capability names every adapter of it: the
// HTTP route, the MCP tool, and the TypeScript client method. The HTTP
// mux is wired by iterating these rows; the MCP server asserts at
// startup that its registered tools match; docs/TOOLS.md's parity
// table is generated from here (cmd/gentools). Adding a capability
// without updating this table is a build/startup failure, not a doc
// drift.
package toolreg

// Decl is one capability's presence across the surfaces. Empty MCP or
// TS means deliberately absent from that surface (noted in Note —
// tenet 2 exceptions are explicit, never accidental).
type Decl struct {
	Capability string // tool-layer entry point (internal/tools)
	Method     string // HTTP method; "" = no HTTP surface
	Path       string // HTTP path pattern
	MCP        string // MCP tool name
	TS         string // web/src/api.ts client method
	Note       string
}

var Decls = []Decl{
	{"ListWorlds", "GET", "/api/worlds", "list_worlds", "listWorlds", ""},
	{"CreateWorld", "POST", "/api/worlds", "create_world", "createWorld", ""},
	{"GetWorld", "GET", "/api/worlds/{id}", "get_world", "getWorld", "includes entry types"},
	{"UpdateWorldSettings", "PATCH", "/api/worlds/{id}", "update_world_settings", "updateWorldSettings", ""},
	{"DeleteWorld", "DELETE", "/api/worlds/{id}", "delete_world", "deleteWorld", ""},
	{"ListEntries", "GET", "/api/worlds/{id}/entries", "list_entries", "listEntries", ""},
	{"CreateEntry", "POST", "/api/worlds/{id}/entries", "create_entry", "createEntry", ""},
	{"GetEntry", "GET", "/api/entries/{id}", "get_entry", "getEntry", "detail=card|digest|full"},
	{"UpdateEntry", "PATCH", "/api/entries/{id}", "update_entry", "updateEntry", "fields accept markdown or docs (ADR 0014)"},
	{"DeleteEntry", "DELETE", "/api/entries/{id}", "delete_entry", "deleteEntry", "AI: draft only"},
	{"MarkCanon", "POST", "/api/entries/{id}/canon", "mark_canon", "markCanon", "scoped: fields/body/edges"},
	{"ListRevisions", "GET", "/api/entries/{id}/revisions", "list_revisions", "listRevisions", ""},
	{"GetRevision", "GET", "/api/entries/{id}/revisions/{rid}", "get_revision", "getRevision", ""},
	{"RestoreRevision", "POST", "/api/entries/{id}/revisions/{rid}/restore", "restore_revision", "restoreRevision", ""},
	{"CreateEdge", "POST", "/api/entries/{id}/edges", "create_edge", "createEdge", "cardinality-one replaces + warns"},
	{"DeleteEdge", "DELETE", "/api/edges/{id}", "delete_edge", "deleteEdge", "AI: draft only"},
	{"UpdateEdgeStatus", "PATCH", "/api/edges/{id}", "update_edge_status", "updateEdgeStatus", "draft/canon per edge"},
	{"Traverse", "GET", "/api/entries/{id}/graph", "traverse", "getGraph", "1–2 hop ego network"},
	{"FindRelevant", "GET", "/api/worlds/{id}/search", "find_relevant", "search", "hybrid scorer (ADR 0010)"},
	{"ExportEntry", "GET", "/api/entries/{id}/export", "export_entry", "", "markdown download; TS uses a plain href"},
	{"ExportWorld", "GET", "/api/worlds/{id}/export", "export_world", "", "vault zip; TS uses a plain href"},
	{"CreateEntryType", "POST", "/api/worlds/{id}/types", "create_entry_type", "createEntryType", ""},
	{"UpdateEntryType", "PATCH", "/api/worlds/{id}/types/{typeId}", "update_entry_type", "updateEntryType", "field identity survives renames (ADR 0015)"},
	{"DumpWorld", "GET", "/api/worlds/{id}/dump", "dump_world", "dumpWorld", "fixture format"},
	{"ImportWorld", "POST", "/api/worlds/import", "import_world", "importWorld", "preserve_ids keeps URLs stable"},
	{"ImportVault", "POST", "/api/worlds/{id}/import-vault", "import_vault", "importVault", "markdown files/zip → draft entries; additive"},
	{"GetContextTray", "GET", "/api/worlds/{id}/tray", "get_context_tray", "getTray", ""},
	{"PinEntry", "POST", "/api/worlds/{id}/tray/pins", "pin_entry", "createPin", ""},
	{"UnpinEntry", "DELETE", "/api/worlds/{id}/tray/pins/{entryId}", "unpin_entry", "deletePin", ""},
	// The in-app chat harness is the deliberate UI-only exception
	// (SPEC tenet 2): conversations exist only over HTTP+SSE.
	{"ListConversations", "GET", "/api/worlds/{id}/conversations", "", "listConversations", "UI-only harness"},
	{"CreateConversation", "POST", "/api/worlds/{id}/conversations", "", "createConversation", "UI-only harness"},
	{"GetConversation", "GET", "/api/conversations/{id}", "", "getConversation", "UI-only harness"},
	{"SendMessage", "POST", "/api/conversations/{id}/messages", "", "sendMessage", "UI-only harness (SSE)"},
	{"EvictAutoItem", "POST", "/api/conversations/{id}/evict", "", "evictAutoItem", "UI-only harness"},
}

// MCPNames returns the expected MCP tool set.
func MCPNames() map[string]bool {
	out := map[string]bool{}
	for _, d := range Decls {
		if d.MCP != "" {
			out[d.MCP] = true
		}
	}
	return out
}

// HTTPRoutes returns "METHOD /path" for every HTTP-surfaced capability.
func HTTPRoutes() map[string]string {
	out := map[string]string{}
	for _, d := range Decls {
		if d.Method != "" {
			out[d.Capability] = d.Method + " " + d.Path
		}
	}
	return out
}
