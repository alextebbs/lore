package api

import (
	"encoding/json"
	"net/http"
	"slices"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alextebbs/lore/internal/agent"
	"github.com/alextebbs/lore/internal/store/db"
	"github.com/alextebbs/lore/internal/tools"
)

// Chat is the in-app agent harness — a UI-only feature by design (SPEC
// tenet 2 exception): it orchestrates public tools, so API/MCP consumers
// already have everything it can do. The tray endpoints ARE capabilities
// and exist on all three surfaces.

func (s *Server) registerChat(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/worlds/{id}/tray", s.getTray)
	mux.HandleFunc("POST /api/worlds/{id}/tray/pins", s.createPin)
	mux.HandleFunc("DELETE /api/worlds/{id}/tray/pins/{entryId}", s.deletePin)
	mux.HandleFunc("GET /api/worlds/{id}/conversations", s.listConversations)
	mux.HandleFunc("POST /api/worlds/{id}/conversations", s.createConversation)
	mux.HandleFunc("GET /api/conversations/{id}", s.getConversation)
	mux.HandleFunc("POST /api/conversations/{id}/messages", s.postMessage)
	mux.HandleFunc("POST /api/conversations/{id}/evict", s.evictAutoItem)
}

func (s *Server) getTray(w http.ResponseWriter, r *http.Request) {
	tray, err := s.Tools.GetContextTray(r.Context(), r.PathValue("id"),
		r.URL.Query().Get("current"), r.URL.Query().Get("q"), nil)
	respond(w, tray, err)
}

func (s *Server) createPin(w http.ResponseWriter, r *http.Request) {
	var in struct {
		EntryID       string `json:"entry_id"`
		WithNeighbors bool   `json:"with_neighbors"`
	}
	if !decode(w, r, &in) {
		return
	}
	err := s.Tools.PinEntry(r.Context(), r.PathValue("id"), in.EntryID, in.WithNeighbors)
	respond(w, map[string]bool{"pinned": err == nil}, err)
}

func (s *Server) deletePin(w http.ResponseWriter, r *http.Request) {
	err := s.Tools.UnpinEntry(r.Context(), r.PathValue("id"), r.PathValue("entryId"))
	respond(w, map[string]bool{"unpinned": err == nil}, err)
}

func pgUUID(s string) (pgtype.UUID, error) {
	id, err := uuid.Parse(s)
	if err != nil {
		return pgtype.UUID{}, err
	}
	return pgtype.UUID{Bytes: id, Valid: true}, nil
}

func newUUID() pgtype.UUID {
	id, _ := uuid.NewV7()
	return pgtype.UUID{Bytes: id, Valid: true}
}

func (s *Server) listConversations(w http.ResponseWriter, r *http.Request) {
	wid, err := pgUUID(r.PathValue("id"))
	if err != nil {
		respond(w, nil, tools.ErrNotFound)
		return
	}
	uid, _ := pgUUID(tools.DevUserID)
	rows, err := s.Store.Queries.ListConversations(r.Context(), db.ListConversationsParams{
		WorldID: wid, UserID: uid,
	})
	out := make([]map[string]any, 0, len(rows))
	for _, c := range rows {
		out = append(out, map[string]any{
			"id": uuid.UUID(c.ID.Bytes).String(), "title": c.Title,
			"message_count": c.MessageCount, "created_at": c.CreatedAt.Time,
		})
	}
	respond(w, out, err)
}

func (s *Server) createConversation(w http.ResponseWriter, r *http.Request) {
	wid, err := pgUUID(r.PathValue("id"))
	if err != nil {
		respond(w, nil, tools.ErrNotFound)
		return
	}
	uid, _ := pgUUID(tools.DevUserID)
	c, err := s.Store.Queries.CreateConversation(r.Context(), db.CreateConversationParams{
		ID: newUUID(), WorldID: wid, UserID: uid, Title: "",
	})
	respond(w, map[string]any{"id": uuid.UUID(c.ID.Bytes).String()}, err)
}

func (s *Server) getConversation(w http.ResponseWriter, r *http.Request) {
	cid, err := pgUUID(r.PathValue("id"))
	if err != nil {
		respond(w, nil, tools.ErrNotFound)
		return
	}
	rows, err := s.Store.Queries.ListMessages(r.Context(), cid)
	out := make([]map[string]any, 0, len(rows))
	for _, m := range rows {
		out = append(out, map[string]any{
			"role": m.Role, "content": json.RawMessage(m.Content),
			"created_at": m.CreatedAt.Time,
		})
	}
	respond(w, out, err)
}

func (s *Server) evictAutoItem(w http.ResponseWriter, r *http.Request) {
	var in struct {
		EntryID string `json:"entry_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	cid, err := pgUUID(r.PathValue("id"))
	if err != nil {
		respond(w, nil, tools.ErrNotFound)
		return
	}
	conv, err := s.Store.Queries.GetConversation(r.Context(), cid)
	if err != nil {
		respond(w, nil, tools.ErrNotFound)
		return
	}
	var evicted []string
	_ = json.Unmarshal(conv.Evicted, &evicted)
	if !slices.Contains(evicted, in.EntryID) {
		evicted = append(evicted, in.EntryID)
	}
	raw, _ := json.Marshal(evicted)
	err = s.Store.Queries.UpdateConversationEvicted(r.Context(), db.UpdateConversationEvictedParams{
		ID: cid, Evicted: raw,
	})
	respond(w, map[string]any{"evicted": evicted}, err)
}

// postMessage runs one agent turn, streaming events as SSE.
func (s *Server) postMessage(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Content        string `json:"content"`
		CurrentEntryID string `json:"current_entry_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	cid, err := pgUUID(r.PathValue("id"))
	if err != nil {
		respond(w, nil, tools.ErrNotFound)
		return
	}
	conv, err := s.Store.Queries.GetConversation(r.Context(), cid)
	if err != nil {
		respond(w, nil, tools.ErrNotFound)
		return
	}
	worldID := uuid.UUID(conv.WorldID.Bytes).String()

	var evicted []string
	_ = json.Unmarshal(conv.Evicted, &evicted)

	// Load history as agent turns.
	msgRows, err := s.Store.Queries.ListMessages(r.Context(), cid)
	if err != nil {
		respond(w, nil, err)
		return
	}
	history := make([]agent.Turn, 0, len(msgRows))
	for _, m := range msgRows {
		history = append(history, agent.Turn{Role: m.Role, Content: m.Content})
	}

	// Persist the user's message (plain text block).
	userBlock, _ := json.Marshal([]map[string]any{{"type": "text", "text": in.Content}})
	if _, err := s.Store.Queries.CreateMessage(r.Context(), db.CreateMessageParams{
		ID: newUUID(), ConversationID: cid, Role: "user", Content: userBlock,
	}); err != nil {
		respond(w, nil, err)
		return
	}
	_ = s.Store.Queries.UpdateConversationTitle(r.Context(), db.UpdateConversationTitleParams{
		ID: cid, Title: truncateTitle(in.Content),
	})

	// SSE stream.
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming unsupported", http.StatusInternalServerError)
		return
	}
	send := func(ev agent.Event) {
		raw, _ := json.Marshal(ev)
		w.Write([]byte("data: "))
		w.Write(raw)
		w.Write([]byte("\n\n"))
		flusher.Flush()
	}

	newTurns, err := s.Agent.Run(r.Context(), worldID, in.CurrentEntryID, in.Content, history, evicted, send)
	// Persist the transcript regardless of error (partial work is real).
	for _, turn := range newTurns {
		role := turn.Role
		if role == "user" {
			role = "tool" // tool_result turns; UI renders them as tool output
		}
		_, _ = s.Store.Queries.CreateMessage(r.Context(), db.CreateMessageParams{
			ID: newUUID(), ConversationID: cid, Role: role, Content: turn.Content,
		})
	}
	if err != nil {
		send(agent.Event{Type: "error", Text: err.Error()})
	}
}

func truncateTitle(s string) string {
	if len(s) > 60 {
		return s[:60] + "…"
	}
	return s
}
