package tools

import (
	"context"
	"os"
	"testing"

	"github.com/alextebbs/lore/internal/store"
)

// Integration tests run against a real Postgres (CONVENTIONS: no store
// mocks). Skipped when DATABASE_URL is unset.
func testTools(t *testing.T) *Tools {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL not set")
	}
	ctx := context.Background()
	if err := store.Migrate(ctx, url); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	st, err := store.Open(ctx, url)
	if err != nil {
		t.Fatalf("open: %v", err)
	}
	t.Cleanup(st.Close)
	return New(st)
}

func TestWorldEntryLifecycle(t *testing.T) {
	tl := testTools(t)
	ctx := context.Background()

	w, err := tl.CreateWorld(ctx, "Testland")
	if err != nil {
		t.Fatalf("CreateWorld: %v", err)
	}

	types, err := tl.ListTypes(ctx, w.ID)
	if err != nil {
		t.Fatalf("ListTypes: %v", err)
	}
	if len(types) != 5 {
		t.Fatalf("seeded types = %d, want 5", len(types))
	}
	var character EntryType
	for _, et := range types {
		if et.Name == "Character" {
			character = et
		}
	}
	if character.ID == "" || len(character.Fields) == 0 {
		t.Fatalf("Character type not seeded properly: %+v", character)
	}

	// Human-authored entry is born canon.
	e, err := tl.CreateEntry(ctx, w.ID, character.ID, "John Doe", AuthorHuman)
	if err != nil {
		t.Fatalf("CreateEntry: %v", err)
	}
	if e.Status != StatusCanon {
		t.Errorf("human entry status = %s, want canon", e.Status)
	}

	// Human update stays canon; unknown field warns but is accepted.
	body := "John rules the docks. {~draft}He fears the sea god.{/~}"
	e2, warnings, err := tl.UpdateEntry(ctx, e.ID, EntryPatch{
		Fields: map[string]any{"gender": "male", "hobby": "sailing"},
		BodyMD: &body,
	}, AuthorHuman)
	if err != nil {
		t.Fatalf("UpdateEntry: %v", err)
	}
	if e2.Status != StatusMixed {
		t.Errorf("status after mixed body = %s, want mixed", e2.Status)
	}
	if e2.BodyMD != body {
		t.Errorf("body round trip: %q != %q", e2.BodyMD, body)
	}
	if len(warnings) == 0 {
		t.Errorf("expected soft-schema warning for undeclared field 'hobby'")
	}

	// AI update makes touched fields draft.
	e3, _, err := tl.UpdateEntry(ctx, e.ID, EntryPatch{
		Fields: map[string]any{"occupation": "smuggler"},
	}, AuthorAI)
	if err != nil {
		t.Fatalf("AI UpdateEntry: %v", err)
	}
	if e3.Fields["occupation"].Status != StatusDraft {
		t.Errorf("AI-written field status = %s, want draft", e3.Fields["occupation"].Status)
	}
	if e3.Fields["gender"].Status != StatusCanon {
		t.Errorf("untouched field status = %s, want canon", e3.Fields["gender"].Status)
	}

	// Scoped promotion: just one field first.
	ePart, err := tl.MarkCanon(ctx, e.ID, CanonScope{Fields: []string{"occupation"}})
	if err != nil {
		t.Fatalf("scoped MarkCanon: %v", err)
	}
	if ePart.Fields["occupation"].Status != StatusCanon {
		t.Errorf("scoped promotion failed: %+v", ePart.Fields["occupation"])
	}
	if ePart.Status != StatusMixed {
		t.Errorf("status after scoped promotion = %s, want mixed (draft body span remains)", ePart.Status)
	}

	// Mark canon promotes everything and strips markers.
	e4, err := tl.MarkCanon(ctx, e.ID, CanonScope{})
	if err != nil {
		t.Fatalf("MarkCanon: %v", err)
	}
	if e4.Status != StatusCanon {
		t.Errorf("status after MarkCanon = %s, want canon", e4.Status)
	}
	if e4.Fields["occupation"].Status != StatusCanon {
		t.Errorf("field not promoted: %+v", e4.Fields["occupation"])
	}
	if want := "John rules the docks. He fears the sea god."; e4.BodyMD != want {
		t.Errorf("body after MarkCanon = %q, want %q", e4.BodyMD, want)
	}

	// Every write recorded a revision:
	// create + 2 updates + scoped canon + full canon = 5.
	revs, err := tl.ListRevisions(ctx, e.ID)
	if err != nil {
		t.Fatalf("ListRevisions: %v", err)
	}
	if len(revs) != 5 {
		t.Errorf("revisions = %d, want 5", len(revs))
	}

	// Restore an old snapshot: content comes back, history grows.
	oldest := revs[len(revs)-1]
	restored, err := tl.RestoreRevision(ctx, e.ID, oldest.ID)
	if err != nil {
		t.Fatalf("RestoreRevision: %v", err)
	}
	if restored.BodyMD != "" {
		t.Errorf("restored body = %q, want empty (creation snapshot)", restored.BodyMD)
	}
	revs2, _ := tl.ListRevisions(ctx, e.ID)
	if len(revs2) != 6 {
		t.Errorf("revisions after restore = %d, want 6", len(revs2))
	}

	// Revision detail exposes the snapshot.
	detail, err := tl.GetRevision(ctx, revs[0].ID)
	if err != nil {
		t.Fatalf("GetRevision: %v", err)
	}
	if detail.Title != "John Doe" {
		t.Errorf("revision detail title = %q", detail.Title)
	}
}
