package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"
)

type fakePinger struct{ err error }

func (f fakePinger) Ping(ctx context.Context) error { return f.err }

func TestHandleHealth(t *testing.T) {
	tests := []struct {
		name       string
		db         Pinger
		wantCode   int
		wantStatus string
		wantDB     string
	}{
		{"no database configured", nil, 200, "ok", "unconfigured"},
		{"database reachable", fakePinger{}, 200, "ok", "ok"},
		{"database down", fakePinger{err: errors.New("conn refused")}, 503, "degraded", "error"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := &Server{DB: tt.db}
			req := httptest.NewRequest("GET", "/api/health", nil)
			rec := httptest.NewRecorder()
			srv.Router().ServeHTTP(rec, req)

			if rec.Code != tt.wantCode {
				t.Errorf("status code = %d, want %d", rec.Code, tt.wantCode)
			}
			var resp healthResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("decoding body: %v", err)
			}
			if resp.Status != tt.wantStatus || resp.DB != tt.wantDB {
				t.Errorf("got %+v, want status=%q db=%q", resp, tt.wantStatus, tt.wantDB)
			}
		})
	}
}
