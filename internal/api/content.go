package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/alextebbs/lore/internal/export"
	"github.com/alextebbs/lore/internal/toolreg"
	"github.com/alextebbs/lore/internal/tools"
)

// Content handlers are thin adapters over the tool layer (ADR 0005).
// The UI is a human surface, so writes here carry AuthorHuman; the agent
// and MCP surfaces (M3/M6) pass AuthorAI through the same tools.

// registerContent wires every content route from the tool registry
// (ADR 0016): the registry is the single declaration of the surface,
// and a capability without a handler here is a startup panic — drift
// fails fast instead of shipping.
func (s *Server) registerContent(mux *http.ServeMux) {
	handlers := map[string]http.HandlerFunc{
		"ListWorlds":          s.listWorlds,
		"CreateWorld":         s.createWorld,
		"GetWorld":            s.getWorld,
		"UpdateWorldSettings": s.updateWorldSettings,
		"DeleteWorld":         s.deleteWorld,
		"ListEntries":         s.listEntries,
		"CreateEntry":         s.createEntry,
		"GetEntry":            s.getEntry,
		"UpdateEntry":         s.updateEntry,
		"DeleteEntry":         s.deleteEntry,
		"MarkCanon":           s.markCanon,
		"ListRevisions":       s.listRevisions,
		"GetRevision":         s.getRevision,
		"RestoreRevision":     s.restoreRevision,
		"CreateEdge":          s.createEdge,
		"DeleteEdge":          s.deleteEdge,
		"UpdateEdgeStatus":    s.updateEdge,
		"Traverse":            s.getGraph,
		"FindRelevant":        s.search,
		"ExportEntry":         s.exportEntry,
		"ExportWorld":         s.exportWorld,
		"CreateEntryType":     s.createEntryType,
		"UpdateEntryType":     s.updateEntryType,
		"DumpWorld":           s.dumpWorld,
		"ImportWorld":         s.importWorld,
		"GetContextTray":      s.getTray,
		"PinEntry":            s.createPin,
		"UnpinEntry":          s.deletePin,
		"ListConversations":   s.listConversations,
		"CreateConversation":  s.createConversation,
		"GetConversation":     s.getConversation,
		"SendMessage":         s.postMessage,
		"EvictAutoItem":       s.evictAutoItem,
	}
	for cap, route := range toolreg.HTTPRoutes() {
		h, ok := handlers[cap]
		if !ok {
			panic(fmt.Sprintf("toolreg: capability %s has no HTTP handler", cap))
		}
		mux.HandleFunc(route, h)
	}
}

func (s *Server) updateWorldSettings(w http.ResponseWriter, r *http.Request) {
	var in tools.WorldSettings
	if !decode(w, r, &in) {
		return
	}
	world, err := s.Tools.UpdateWorldSettings(r.Context(), r.PathValue("id"), in)
	respond(w, world, err)
}

func (s *Server) deleteWorld(w http.ResponseWriter, r *http.Request) {
	err := s.Tools.DeleteWorld(r.Context(), r.PathValue("id"))
	respond(w, map[string]bool{"deleted": err == nil}, err)
}

func (s *Server) deleteEntry(w http.ResponseWriter, r *http.Request) {
	err := s.Tools.DeleteEntry(r.Context(), r.PathValue("id"), tools.AuthorHuman, true)
	respond(w, map[string]bool{"deleted": err == nil}, err)
}

func (s *Server) createEntryType(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name     string           `json:"name"`
		ParentID string           `json:"parent_id"`
		Fields   []tools.FieldDef `json:"fields"`
	}
	if !decode(w, r, &in) {
		return
	}
	et, warnings, err := s.Tools.CreateEntryType(r.Context(), r.PathValue("id"), in.Name, in.ParentID, in.Fields)
	respond(w, map[string]any{"type": et, "warnings": warnings}, err)
}

func (s *Server) updateEntryType(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name    string            `json:"name"`
		Fields  []tools.FieldDef  `json:"fields"`
		Renames map[string]string `json:"renames"`
	}
	if !decode(w, r, &in) {
		return
	}
	et, warnings, err := s.Tools.UpdateEntryType(r.Context(), r.PathValue("id"), r.PathValue("typeId"), in.Name, in.Fields, in.Renames)
	respond(w, map[string]any{"type": et, "warnings": warnings}, err)
}

func (s *Server) dumpWorld(w http.ResponseWriter, r *http.Request) {
	dump, err := s.Tools.DumpWorld(r.Context(), r.PathValue("id"))
	respond(w, dump, err)
}

func (s *Server) importWorld(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name        string          `json:"name"`
		Dump        tools.WorldDump `json:"dump"`
		PreserveIDs bool            `json:"preserve_ids"`
	}
	if !decode(w, r, &in) {
		return
	}
	world, err := s.Tools.ImportWorld(r.Context(), in.Dump, in.Name, in.PreserveIDs)
	respond(w, world, err)
}

func (s *Server) exportEntry(w http.ResponseWriter, r *http.Request) {
	e, err := s.Tools.GetEntry(r.Context(), r.PathValue("id"))
	if err != nil {
		respond(w, nil, err)
		return
	}
	md := export.RenderEntry(e)
	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf("attachment; filename=%q", export.SafeFilename(e.Title)+".md"))
	w.Write([]byte(md))
}

func (s *Server) exportWorld(w http.ResponseWriter, r *http.Request) {
	worldID := r.PathValue("id")
	world, err := s.Tools.GetWorld(r.Context(), worldID)
	if err != nil {
		respond(w, nil, err)
		return
	}
	files, err := export.BuildVault(r.Context(), s.Tools, worldID)
	if err != nil {
		respond(w, nil, err)
		return
	}
	blob, err := export.Zip(files)
	if err != nil {
		respond(w, nil, err)
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition",
		fmt.Sprintf("attachment; filename=%q", export.SafeFilename(world.Name)+"-vault.zip"))
	w.Write(blob)
}

func (s *Server) listWorlds(w http.ResponseWriter, r *http.Request) {
	worlds, err := s.Tools.ListWorlds(r.Context())
	respond(w, worlds, err)
}

func (s *Server) createWorld(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name string `json:"name"`
	}
	if !decode(w, r, &in) {
		return
	}
	world, err := s.Tools.CreateWorld(r.Context(), in.Name)
	respond(w, world, err)
}

func (s *Server) getWorld(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	world, err := s.Tools.GetWorld(r.Context(), id)
	if err != nil {
		respond(w, nil, err)
		return
	}
	types, err := s.Tools.ListTypes(r.Context(), id)
	respond(w, map[string]any{"world": world, "types": types}, err)
}

func (s *Server) listEntries(w http.ResponseWriter, r *http.Request) {
	entries, err := s.Tools.ListEntries(r.Context(), r.PathValue("id"))
	respond(w, entries, err)
}

func (s *Server) createEntry(w http.ResponseWriter, r *http.Request) {
	var in struct {
		TypeID string `json:"type_id"`
		Title  string `json:"title"`
	}
	if !decode(w, r, &in) {
		return
	}
	entry, err := s.Tools.CreateEntry(r.Context(), r.PathValue("id"), in.TypeID, in.Title, tools.AuthorHuman)
	respond(w, entry, err)
}

func (s *Server) getEntry(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	switch r.URL.Query().Get("detail") {
	case "card":
		card, _, err := s.Tools.Serializations(r.Context(), id)
		respond(w, map[string]string{"id": id, "card": card}, err)
	case "digest":
		_, digest, err := s.Tools.Serializations(r.Context(), id)
		respond(w, map[string]string{"id": id, "digest": digest}, err)
	default:
		entry, err := s.Tools.GetEntry(r.Context(), id)
		respond(w, entry, err)
	}
}

func (s *Server) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	var near []string
	if n := q.Get("near"); n != "" {
		near = strings.Split(n, ",")
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	results, err := s.Tools.FindRelevant(r.Context(), r.PathValue("id"),
		q.Get("q"), q.Get("canon_only") == "true", near, limit)
	respond(w, results, err)
}

func (s *Server) updateEntry(w http.ResponseWriter, r *http.Request) {
	var patch tools.EntryPatch
	if !decode(w, r, &patch) {
		return
	}
	entry, warnings, err := s.Tools.UpdateEntry(r.Context(), r.PathValue("id"), patch, tools.AuthorHuman)
	respond(w, map[string]any{"entry": entry, "warnings": warnings}, err)
}

func (s *Server) markCanon(w http.ResponseWriter, r *http.Request) {
	var scope tools.CanonScope
	if r.ContentLength > 0 && !decode(w, r, &scope) {
		return
	}
	entry, err := s.Tools.MarkCanon(r.Context(), r.PathValue("id"), scope)
	respond(w, entry, err)
}

func (s *Server) getRevision(w http.ResponseWriter, r *http.Request) {
	rev, err := s.Tools.GetRevision(r.Context(), r.PathValue("rid"))
	respond(w, rev, err)
}

func (s *Server) restoreRevision(w http.ResponseWriter, r *http.Request) {
	entry, err := s.Tools.RestoreRevision(r.Context(), r.PathValue("id"), r.PathValue("rid"))
	respond(w, entry, err)
}

func (s *Server) listRevisions(w http.ResponseWriter, r *http.Request) {
	revs, err := s.Tools.ListRevisions(r.Context(), r.PathValue("id"))
	respond(w, revs, err)
}

func (s *Server) createEdge(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Field      string `json:"field"`
		To         string `json:"to"`
		Annotation string `json:"annotation"`
	}
	if !decode(w, r, &in) {
		return
	}
	edge, warnings, err := s.Tools.CreateEdge(r.Context(), r.PathValue("id"), in.Field, in.To, in.Annotation, tools.AuthorHuman)
	respond(w, map[string]any{"edge": edge, "warnings": warnings}, err)
}

func (s *Server) deleteEdge(w http.ResponseWriter, r *http.Request) {
	err := s.Tools.DeleteEdge(r.Context(), r.PathValue("id"), tools.AuthorHuman)
	respond(w, map[string]bool{"deleted": err == nil}, err)
}

func (s *Server) updateEdge(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Status string `json:"status"`
	}
	if !decode(w, r, &in) {
		return
	}
	edge, err := s.Tools.UpdateEdgeStatus(r.Context(), r.PathValue("id"), in.Status, tools.AuthorHuman)
	respond(w, edge, err)
}

func (s *Server) getGraph(w http.ResponseWriter, r *http.Request) {
	depth := 1
	if r.URL.Query().Get("depth") == "2" {
		depth = 2
	}
	graph, err := s.Tools.Traverse(r.Context(), r.PathValue("id"), depth)
	respond(w, graph, err)
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		http.Error(w, `{"error":"invalid JSON body"}`, http.StatusBadRequest)
		return false
	}
	return true
}

func respond(w http.ResponseWriter, v any, err error) {
	w.Header().Set("Content-Type", "application/json")
	switch {
	case errors.Is(err, tools.ErrNotFound):
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "not found"})
	case err != nil:
		slog.Error("api error", "error", err)
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
	default:
		json.NewEncoder(w).Encode(v)
	}
}
