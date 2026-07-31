// Package retrieval provides the optional semantic layer of the hybrid
// scorer (ADR 0010): Voyage AI embeddings stored in pgvector. Both
// dependencies are optional at runtime — no VOYAGE_API_KEY or no
// pgvector extension means the engine reports unavailable and
// find_relevant runs lexical + graph + canon only (ADR 0007).
//
// The embeddings table is created here at runtime, NOT in goose
// migrations, so the static schema stays portable (bead lore-8q6).
package retrieval

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/alextebbs/lore/internal/store"
)

const (
	voyageURL   = "https://api.voyageai.com/v1/embeddings"
	voyageModel = "voyage-3.5-lite"
	dims        = 1024
)

type Engine struct {
	store  *store.Store
	apiKey string
	ready  bool // pgvector present AND key configured
	queue  chan embedJob
}

type embedJob struct {
	entryID string
	card    string
}

// New probes pgvector, prepares the embeddings table when possible, and
// starts the background embed worker.
func New(ctx context.Context, st *store.Store, apiKey string) *Engine {
	e := &Engine{store: st, apiKey: apiKey, queue: make(chan embedJob, 256)}

	var hasVector bool
	if err := st.Pool.QueryRow(ctx,
		`SELECT count(*) > 0 FROM pg_extension WHERE extname = 'vector'`,
	).Scan(&hasVector); err != nil {
		slog.Warn("retrieval: pgvector probe failed", "error", err)
	}
	if hasVector && apiKey != "" {
		_, err := st.Pool.Exec(ctx, fmt.Sprintf(`
			CREATE TABLE IF NOT EXISTS entry_embeddings (
				entry_id   uuid PRIMARY KEY REFERENCES entries (id) ON DELETE CASCADE,
				embedding  vector(%d) NOT NULL,
				updated_at timestamptz NOT NULL DEFAULT now()
			)`, dims))
		if err != nil {
			slog.Warn("retrieval: creating embeddings table failed", "error", err)
		} else {
			e.ready = true
		}
	}
	slog.Info("retrieval engine", "semantic", e.ready,
		"pgvector", hasVector, "voyage_key", apiKey != "")

	go e.worker()
	return e
}

// Ready reports whether semantic search is active.
func (e *Engine) Ready() bool { return e.ready }

// EnqueueEntry schedules (re-)embedding of an entry's card. Non-blocking;
// drops on overflow (the next write re-enqueues).
func (e *Engine) EnqueueEntry(entryID, card string) {
	if !e.ready {
		return
	}
	select {
	case e.queue <- embedJob{entryID: entryID, card: card}:
	default:
		slog.Warn("retrieval: embed queue full, dropping", "entry", entryID)
	}
}

func (e *Engine) worker() {
	for job := range e.queue {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		vec, err := e.embed(ctx, job.card, "document")
		if err != nil {
			slog.Warn("retrieval: embedding failed", "entry", job.entryID, "error", err)
			cancel()
			continue
		}
		_, err = e.store.Pool.Exec(ctx, `
			INSERT INTO entry_embeddings (entry_id, embedding, updated_at)
			VALUES ($1, $2::vector, now())
			ON CONFLICT (entry_id) DO UPDATE
			SET embedding = EXCLUDED.embedding, updated_at = now()`,
			job.entryID, vectorLiteral(vec))
		if err != nil {
			slog.Warn("retrieval: storing embedding failed", "entry", job.entryID, "error", err)
		}
		cancel()
	}
}

// Similar embeds the query and returns entry_id -> cosine similarity for
// the world's embedded entries. ok=false when semantic is unavailable.
func (e *Engine) Similar(ctx context.Context, worldID, query string) (map[string]float64, bool) {
	if !e.ready {
		return nil, false
	}
	vec, err := e.embed(ctx, query, "query")
	if err != nil {
		slog.Warn("retrieval: query embedding failed", "error", err)
		return nil, false
	}
	rows, err := e.store.Pool.Query(ctx, `
		SELECT em.entry_id, 1 - (em.embedding <=> $2::vector) AS sim
		FROM entry_embeddings em
		JOIN entries en ON en.id = em.entry_id
		WHERE en.world_id = $1
		ORDER BY em.embedding <=> $2::vector
		LIMIT 100`, worldID, vectorLiteral(vec))
	if err != nil {
		slog.Warn("retrieval: semantic query failed", "error", err)
		return nil, false
	}
	defer rows.Close()
	out := map[string]float64{}
	for rows.Next() {
		var id string
		var sim float64
		if err := rows.Scan(&id, &sim); err != nil {
			return nil, false
		}
		out[id] = sim
	}
	return out, true
}

func (e *Engine) embed(ctx context.Context, text, inputType string) ([]float64, error) {
	body, _ := json.Marshal(map[string]any{
		"input": []string{text}, "model": voyageModel,
		"input_type": inputType, "output_dimension": dims,
	})
	req, err := http.NewRequestWithContext(ctx, "POST", voyageURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+e.apiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		var msg bytes.Buffer
		msg.ReadFrom(resp.Body)
		return nil, fmt.Errorf("voyage %d: %s", resp.StatusCode, msg.String())
	}
	var out struct {
		Data []struct {
			Embedding []float64 `json:"embedding"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	if len(out.Data) == 0 {
		return nil, fmt.Errorf("voyage returned no embeddings")
	}
	return out.Data[0].Embedding, nil
}

func vectorLiteral(vec []float64) string {
	parts := make([]string, len(vec))
	for i, v := range vec {
		parts[i] = fmt.Sprintf("%g", v)
	}
	return "[" + strings.Join(parts, ",") + "]"
}
