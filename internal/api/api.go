// Package api contains the HTTP handlers. Handlers are thin adapters:
// once the tool layer exists (ADR 0005), all capability logic lives there,
// never here.
package api

import (
	"context"
	"net/http"
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
}

func (s *Server) Router() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.handleHealth)
	if s.Static != nil {
		mux.Handle("/", s.Static)
	}
	return mux
}
