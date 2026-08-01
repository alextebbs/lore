package tools

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alextebbs/lore/internal/store/db"
)

// Tenet 5 — "AI freely modifies drafts; canon is protected" — has
// exactly one derivation point. Every mutation asks mayTouchCanon
// before altering canon content; the answer folds together the caller
// (humans always may), the per-call override (only set on explicit
// user instruction), and the world's ai_can_edit_canon policy.
//
// Call sites keep their own contextual error text via refuseCanon so
// refusals stay actionable ("field X", "the body", "this edge"), but
// none of them re-derive the decision.

type canonPolicy struct{ allowed bool }

func (t *Tools) mayTouchCanon(ctx context.Context, worldID pgtype.UUID, author Author, override bool) canonPolicy {
	if author != AuthorAI || override {
		return canonPolicy{allowed: true}
	}
	settings := WorldSettings{}
	if w, err := t.store.Queries.GetWorld(ctx, worldID); err == nil {
		settings = parseSettings(w.Settings)
	}
	return canonPolicy{allowed: settings.AICanEditCanon}
}

// refuseCanon returns the standard tenet-5 refusal for `what` (e.g.
// "canon field \"origin\"") — or nil when the policy allows the touch.
func (p canonPolicy) refuseCanon(what string) error {
	if p.allowed {
		return nil
	}
	return fmt.Errorf("%s is protected: ask the user to permit the edit (canon_override) or work in drafts", what)
}

// checkWorldOwner is the ownership seam: today every caller is the dev
// user and every world is owned by them, so this always passes — but
// mutations on a world route through it, so real auth only has to
// change this one function.
func (t *Tools) checkWorldOwner(w db.World) error {
	owner, _ := parseID(DevUserID)
	if w.OwnerID != owner {
		return fmt.Errorf("world %q belongs to another user", w.Name)
	}
	return nil
}
