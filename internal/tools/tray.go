package tools

import (
	"context"
	"fmt"
	"slices"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alextebbs/lore/internal/store/db"
)

// The context tray (SPEC): the persistent, per-user, per-world working
// set of entries in AI context. Pins follow the user; the current page
// joins implicitly; auto items come from find_relevant. Fully
// inspectable: every item carries its exact serialized text and a token
// estimate.

const (
	// trayTokenBudget bounds the serialized tray; items degrade
	// full -> digest -> card before anything is dropped (overflow ladder).
	trayTokenBudget = 8000
)

type TrayItem struct {
	EntryID   string `json:"entry_id"`
	Title     string `json:"title"`
	Source    string `json:"source"` // pinned | current | neighbor | auto
	Level     string `json:"level"`  // full | digest | card
	Text      string `json:"text"`   // exact serialized text sent to the model
	Tokens    int    `json:"tokens"` // estimate (chars/4)
	Neighbors bool   `json:"neighbors,omitempty"`
	Score     float64 `json:"score,omitempty"` // for auto items
}

type Tray struct {
	Items       []TrayItem `json:"items"`
	TotalTokens int        `json:"total_tokens"`
	Budget      int        `json:"budget"`
}

func estTokens(s string) int { return len(s)/4 + 1 }

// entrySerialization renders an entry at a level; full = markdown export
// of everything the model needs.
func (t *Tools) entrySerialization(ctx context.Context, entryID, level string) (string, string, error) {
	switch level {
	case "card":
		card, _, err := t.Serializations(ctx, entryID)
		return card, "", err
	case "digest":
		_, digest, err := t.Serializations(ctx, entryID)
		return digest, "", err
	}
	e, err := t.GetEntry(ctx, entryID)
	if err != nil {
		return "", "", err
	}
	text := fmt.Sprintf("# %s (%s, %s) [id: %s]\n", e.Title, e.TypeName, e.Status, e.ID)
	for name, fv := range e.Fields {
		text += fmt.Sprintf("- %s: %s (%s)\n", name, fieldValueText(fv.Value), fv.Status)
	}
	for _, sec := range e.Relations {
		arrow := "→"
		if sec.Reverse {
			arrow = "←"
		}
		for _, edge := range sec.Edges {
			text += fmt.Sprintf("- %s %s %s (%s)", sec.Label, arrow, edge.To.Title, edge.Status)
			if edge.Annotation != "" {
				text += " — " + edge.Annotation
			}
			text += "\n"
		}
	}
	if e.BodyMD != "" {
		text += "\n" + e.BodyMD + "\n"
	}
	return text, e.Title, nil
}

// PinEntry adds an entry (optionally with its neighbors) to the user's
// tray for a world.
func (t *Tools) PinEntry(ctx context.Context, worldID, entryID string, withNeighbors bool) error {
	uid, _ := parseID(DevUserID)
	wid, err := parseID(worldID)
	if err != nil {
		return err
	}
	eid, err := parseID(entryID)
	if err != nil {
		return err
	}
	if _, err := t.store.Queries.GetEntry(ctx, eid); err != nil {
		return notFound(err)
	}
	return t.store.Queries.CreatePin(ctx, db.CreatePinParams{
		UserID: uid, WorldID: wid, EntryID: eid, WithNeighbors: withNeighbors,
	})
}

func (t *Tools) UnpinEntry(ctx context.Context, worldID, entryID string) error {
	uid, _ := parseID(DevUserID)
	wid, err := parseID(worldID)
	if err != nil {
		return err
	}
	eid, err := parseID(entryID)
	if err != nil {
		return err
	}
	return t.store.Queries.DeletePin(ctx, db.DeletePinParams{
		UserID: uid, WorldID: wid, EntryID: eid,
	})
}

// GetContextTray assembles the tray: pins (+ neighbor expansions), the
// current entry, and auto items retrieved for the query. Items degrade
// full → digest → card as the budget fills.
func (t *Tools) GetContextTray(ctx context.Context, worldID, currentEntryID, query string, evicted []string) (Tray, error) {
	uid, _ := parseID(DevUserID)
	wid, err := parseID(worldID)
	if err != nil {
		return Tray{}, err
	}

	type slot struct {
		entryID string
		source  string
		score   float64
	}
	var slots []slot
	seen := map[string]bool{}
	add := func(id, source string, score float64) {
		if id == "" || seen[id] || slices.Contains(evicted, id) {
			return
		}
		seen[id] = true
		slots = append(slots, slot{entryID: id, source: source, score: score})
	}

	if currentEntryID != "" {
		add(currentEntryID, "current", 0)
	}
	pins, err := t.store.Queries.ListPins(ctx, db.ListPinsParams{UserID: uid, WorldID: wid})
	if err != nil {
		return Tray{}, err
	}
	for _, p := range pins {
		add(idStr(p.EntryID), "pinned", 0)
	}
	// Neighbor expansion for pins marked with_neighbors.
	for _, p := range pins {
		if !p.WithNeighbors {
			continue
		}
		g, err := t.Traverse(ctx, idStr(p.EntryID), 1)
		if err != nil {
			continue
		}
		for _, n := range g.Nodes {
			add(n.ID, "neighbor", 0)
		}
	}
	// Auto items: retrieval against the query, boosted near current+pins.
	if query != "" {
		var near []string
		if currentEntryID != "" {
			near = append(near, currentEntryID)
		}
		for _, p := range pins {
			near = append(near, idStr(p.EntryID))
		}
		results, err := t.FindRelevant(ctx, worldID, query, false, near, 5)
		if err == nil {
			for _, r := range results {
				add(r.ID, "auto", r.Score)
			}
		}
	}

	// Serialize with the overflow ladder: try full for everything; while
	// over budget, degrade the largest non-current items.
	tray := Tray{Budget: trayTokenBudget}
	for _, s := range slots {
		level := "full"
		if s.source == "neighbor" || s.source == "auto" {
			level = "digest"
		}
		text, title, err := t.entrySerialization(ctx, s.entryID, level)
		if err != nil {
			continue
		}
		if title == "" {
			if e, err := t.store.Queries.GetEntry(ctx, mustID(s.entryID)); err == nil {
				title = e.Title
			}
		}
		tray.Items = append(tray.Items, TrayItem{
			EntryID: s.entryID, Title: title, Source: s.source, Level: level,
			Text: text, Tokens: estTokens(text), Score: s.score,
		})
	}
	total := func() int {
		n := 0
		for _, it := range tray.Items {
			n += it.Tokens
		}
		return n
	}
	degrade := map[string]string{"full": "digest", "digest": "card"}
	for total() > tray.Budget {
		// degrade the largest degradable item; drop cards last-resort
		worst := -1
		for i, it := range tray.Items {
			if it.Level == "card" || it.Source == "current" {
				continue
			}
			if worst == -1 || it.Tokens > tray.Items[worst].Tokens {
				worst = i
			}
		}
		if worst == -1 {
			// everything is card/current; drop the last auto item
			dropped := false
			for i := len(tray.Items) - 1; i >= 0; i-- {
				if tray.Items[i].Source == "auto" || tray.Items[i].Source == "neighbor" {
					tray.Items = append(tray.Items[:i], tray.Items[i+1:]...)
					dropped = true
					break
				}
			}
			if !dropped {
				break
			}
			continue
		}
		it := &tray.Items[worst]
		text, _, err := t.entrySerialization(ctx, it.EntryID, degrade[it.Level])
		if err != nil {
			break
		}
		it.Level = degrade[it.Level]
		it.Text = text
		it.Tokens = estTokens(text)
	}
	tray.TotalTokens = total()
	return tray, nil
}

func mustID(s string) pgtype.UUID {
	u, _ := parseID(s)
	return u
}
