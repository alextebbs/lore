package tools

import (
	"context"
	"sort"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alextebbs/lore/internal/store/db"
)

// SearchResult is one ranked hit from find_relevant.
type SearchResult struct {
	ID       string  `json:"id"`
	Title    string  `json:"title"`
	TypeName string  `json:"type_name"`
	Status   string  `json:"status"`
	Card     string  `json:"card"`
	Score    float64 `json:"score"`
}

// FindRelevant is THE search path (ADR 0010): one hybrid scorer behind
// every surface. Blend: lexical (FTS + title trigram) + semantic (when
// available) + graph proximity to `near` entries + canon weighting.
func (t *Tools) FindRelevant(ctx context.Context, worldID, query string, canonOnly bool, near []string, limit int) ([]SearchResult, error) {
	wid, err := parseID(worldID)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	rows, err := t.store.Queries.SearchLexical(ctx, db.SearchLexicalParams{
		WorldID: wid, PlaintoTsquery: query, Column3: canonOnly,
	})
	if err != nil {
		return nil, err
	}

	// Graph proximity: entries 1 hop from `near` get a strong boost,
	// 2 hops a weaker one.
	proximity := map[string]float64{}
	if len(near) > 0 {
		frontier := make([]pgtype.UUID, 0, len(near))
		for _, id := range near {
			if u, err := parseID(id); err == nil {
				frontier = append(frontier, u)
				proximity[id] = 0.2 // the near entries themselves
			}
		}
		for hop, boost := range []float64{0.15, 0.07} {
			_ = hop
			if len(frontier) == 0 {
				break
			}
			edges, err := t.store.Queries.ListEdgesTouching(ctx, frontier)
			if err != nil {
				return nil, err
			}
			var next []pgtype.UUID
			for _, e := range edges {
				for _, end := range []pgtype.UUID{e.FromEntry, e.ToEntry} {
					id := idStr(end)
					if _, seen := proximity[id]; !seen {
						proximity[id] = boost
						next = append(next, end)
					}
				}
			}
			frontier = next
		}
	}

	semantic, hasSemantic := map[string]float64{}, false
	if t.semantic != nil {
		semantic, hasSemantic = t.semantic.Similar(ctx, worldID, query)
	}

	lexWeight, semWeight := 0.6, 0.0
	if hasSemantic {
		lexWeight, semWeight = 0.4, 0.3
	}

	var maxRank float64
	for _, r := range rows {
		if r.Rank > maxRank {
			maxRank = r.Rank
		}
	}

	results := make([]SearchResult, 0, len(rows))
	for _, r := range rows {
		id := idStr(r.ID)
		lex := r.TitleSim * 0.5
		if maxRank > 0 {
			lex += (r.Rank / maxRank) * 0.5
		}
		score := lexWeight*lex + semWeight*semantic[id] + proximity[id]
		if r.Status == StatusCanon {
			score += 0.05
		}
		if score <= 0.01 {
			continue
		}
		results = append(results, SearchResult{
			ID: id, Title: r.Title, TypeName: r.TypeName,
			Status: r.Status, Card: r.Card, Score: score,
		})
	}
	sort.Slice(results, func(i, j int) bool { return results[i].Score > results[j].Score })
	if len(results) > limit {
		results = results[:limit]
	}
	return results, nil
}
