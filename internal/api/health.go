package api

import (
	"encoding/json"
	"net/http"
)

type healthResponse struct {
	Status string `json:"status"`
	DB     string `json:"db"`
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	resp := healthResponse{Status: "ok", DB: "unconfigured"}
	if s.DB != nil {
		if err := s.DB.Ping(r.Context()); err != nil {
			resp.Status = "degraded"
			resp.DB = "error"
		} else {
			resp.DB = "ok"
		}
	}
	w.Header().Set("Content-Type", "application/json")
	if resp.Status != "ok" {
		w.WriteHeader(http.StatusServiceUnavailable)
	}
	json.NewEncoder(w).Encode(resp)
}
