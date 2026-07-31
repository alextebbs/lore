package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

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
	entry, err := s.Tools.GetEntry(r.Context(), r.PathValue("id"))
	respond(w, entry, err)
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
