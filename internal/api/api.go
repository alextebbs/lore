// Package api contains the HTTP handlers. Handlers are thin adapters:
// once the tool layer exists (ADR 0005), all capability logic lives there,
// never here.
package api

import (
	"context"
	"net/http"

	"github.com/alextebbs/lore/internal/agent"
	"github.com/alextebbs/lore/internal/store"
	"github.com/alextebbs/lore/internal/tools"
)

// Pinger reports storage connectivity. *pgxpool.Pool satisfies it.
type Pinger interface {
	Ping(ctx context.Context) error
}

type Server struct {
	// DB is nil until the store is wired in; health reports it as
	// "unconfigured" rather than failing.
	DB Pinger
	// Static serves the built SPA at "/"; nil in tests.
	Static http.Handler
	// Tools is the capability layer; content routes register only when
	// it's wired (i.e., a database is configured).
	Tools *tools.Tools
	// MCP is the MCP endpoint handler, mounted at /mcp.
	MCP http.Handler
	// Store backs conversation persistence for the chat harness.
	Store *store.Store
	// Agent is the in-app chat harness (UI-only orchestration).
	Agent *agent.Agent
}

func (s *Server) Router() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	if s.Tools != nil {
		s.registerContent(mux)
	}
	if s.Store != nil && s.Agent != nil {
		s.registerChat(mux)
	}
	if s.MCP != nil {
		mux.Handle("/mcp", s.MCP)
	}
	if s.Static != nil {
		mux.Handle("/", s.Static)
	}
	return mux
}
