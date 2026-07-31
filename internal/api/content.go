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
	"github.com/alextebbs/lore/internal/tools"
)

// Content handlers are thin adapters over the tool layer (ADR 0005).
// The UI is a human surface, so writes here carry AuthorHuman; the agent
// and MCP surfaces (M3/M6) pass AuthorAI through the same tools.

func (s *Server) registerContent(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/worlds", s.listWorlds)
	mux.HandleFunc("POST /api/worlds", s.createWorld)
	mux.HandleFunc("GET /api/worlds/{id}", s.getWorld)
	mux.HandleFunc("GET /api/worlds/{id}/entries", s.listEntries)
	mux.HandleFunc("POST /api/worlds/{id}/entries", s.createEntry)
	mux.HandleFunc("GET /api/entries/{id}", s.getEntry)
	mux.HandleFunc("PATCH /api/entries/{id}", s.updateEntry)
	mux.HandleFunc("POST /api/entries/{id}/canon", s.markCanon)
	mux.HandleFunc("GET /api/entries/{id}/revisions", s.listRevisions)
	mux.HandleFunc("GET /api/entries/{id}/revisions/{rid}", s.getRevision)
	mux.HandleFunc("POST /api/entries/{id}/revisions/{rid}/restore", s.restoreRevision)
	mux.HandleFunc("POST /api/entries/{id}/edges", s.createEdge)
	mux.HandleFunc("DELETE /api/edges/{id}", s.deleteEdge)
	mux.HandleFunc("GET /api/entries/{id}/graph", s.getGraph)
	mux.HandleFunc("GET /api/worlds/{id}/search", s.search)
	mux.HandleFunc("GET /api/entries/{id}/export", s.exportEntry)
	mux.HandleFunc("GET /api/worlds/{id}/export", s.exportWorld)
	mux.HandleFunc("POST /api/worlds/{id}/types", s.createEntryType)
	mux.HandleFunc("GET /api/worlds/{id}/dump", s.dumpWorld)
	mux.HandleFunc("POST /api/worlds/import", s.importWorld)
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

func (s *Server) dumpWorld(w http.ResponseWriter, r *http.Request) {
	dump, err := s.Tools.DumpWorld(r.Context(), r.PathValue("id"))
	respond(w, dump, err)
}

func (s *Server) importWorld(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Name string          `json:"name"`
		Dump tools.WorldDump `json:"dump"`
	}
	if !decode(w, r, &in) {
		return
	}
	world, err := s.Tools.ImportWorld(r.Context(), in.Dump, in.Name)
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
