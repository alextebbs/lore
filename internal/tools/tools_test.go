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

func TestEdgesAndGraph(t *testing.T) {
	tl := testTools(t)
	ctx := context.Background()

	w, err := tl.CreateWorld(ctx, "Edgeland")
	if err != nil {
		t.Fatalf("CreateWorld: %v", err)
	}
	types, _ := tl.ListTypes(ctx, w.ID)
	typeID := map[string]string{}
	for _, et := range types {
		typeID[et.Name] = et.ID
	}

	john, _ := tl.CreateEntry(ctx, w.ID, typeID["Character"], "John", AuthorHuman)
	jane, _ := tl.CreateEntry(ctx, w.ID, typeID["Character"], "Jane", AuthorHuman)
	chicago, _ := tl.CreateEntry(ctx, w.ID, typeID["Place"], "Chicago", AuthorHuman)
	guild, _ := tl.CreateEntry(ctx, w.ID, typeID["Faction"], "Thieves Guild", AuthorHuman)

	// Human edge is canon; annotation carried.
	fam, warns, err := tl.CreateEdge(ctx, john.ID, "family", jane.ID, "Jane is John's older sister", AuthorHuman)
	if err != nil {
		t.Fatalf("CreateEdge: %v", err)
	}
	if fam.Status != StatusCanon || len(warns) != 0 {
		t.Errorf("family edge status=%s warns=%v", fam.Status, warns)
	}

	// Cardinality one: second hometown replaces the first.
	if _, _, err := tl.CreateEdge(ctx, john.ID, "hometown", chicago.ID, "", AuthorHuman); err != nil {
		t.Fatalf("hometown edge: %v", err)
	}
	springfield, _ := tl.CreateEntry(ctx, w.ID, typeID["Place"], "Springfield", AuthorHuman)
	if _, _, err := tl.CreateEdge(ctx, john.ID, "hometown", springfield.ID, "", AuthorHuman); err != nil {
		t.Fatalf("hometown replace: %v", err)
	}

	// AI edge is draft; off-target type warns but succeeds.
	aiEdge, warns, err := tl.CreateEdge(ctx, guild.ID, "members", chicago.ID, "", AuthorAI)
	if err != nil {
		t.Fatalf("AI CreateEdge: %v", err)
	}
	if aiEdge.Status != StatusDraft {
		t.Errorf("AI edge status = %s, want draft", aiEdge.Status)
	}
	if len(warns) == 0 {
		t.Errorf("expected off-target warning for Place in members")
	}

	// Entry payload: outgoing sections + reverse sections.
	johnFull, err := tl.GetEntry(ctx, john.ID)
	if err != nil {
		t.Fatalf("GetEntry: %v", err)
	}
	var hometownEdges, familyEdges int
	for _, sec := range johnFull.Relations {
		switch sec.Field {
		case "hometown":
			hometownEdges = len(sec.Edges)
			if len(sec.Edges) == 1 && sec.Edges[0].To.Title != "Springfield" {
				t.Errorf("hometown = %s, want Springfield (replaced)", sec.Edges[0].To.Title)
			}
		case "family":
			familyEdges = len(sec.Edges)
		}
	}
	if hometownEdges != 1 || familyEdges != 1 {
		t.Errorf("john sections: hometown=%d family=%d, want 1/1", hometownEdges, familyEdges)
	}
	// Bidirectional presentation: Jane's own family section shows John
	// (incoming edge merged in), with no duplicate Family reverse section.
	janeFull, _ := tl.GetEntry(ctx, jane.ID)
	foundMerged := false
	for _, sec := range janeFull.Relations {
		if sec.Field == "family" {
			for _, e := range sec.Edges {
				if e.To.Title == "John" && e.Incoming {
					foundMerged = true
				}
			}
		}
	}
	if !foundMerged {
		t.Errorf("jane's family section missing merged incoming John: %+v", janeFull.Relations)
	}
	for _, sec := range janeFull.Reverse {
		if sec.Label == "Family" {
			t.Errorf("duplicate Family reverse section should not exist: %+v", sec)
		}
	}

	// AI cannot delete the canon family edge.
	if err := tl.DeleteEdge(ctx, fam.ID, AuthorAI); err == nil {
		t.Errorf("AI deleted a canon edge — tenet 5 violated")
	}
	// AI can delete its own draft edge.
	if err := tl.DeleteEdge(ctx, aiEdge.ID, AuthorAI); err != nil {
		t.Errorf("AI could not delete draft edge: %v", err)
	}

	// Graph: 1 hop from John covers Jane + Springfield; depth 2 nothing new.
	g, err := tl.Traverse(ctx, john.ID, 1)
	if err != nil {
		t.Fatalf("Traverse: %v", err)
	}
	if len(g.Nodes) != 3 || len(g.Edges) != 2 {
		t.Errorf("graph nodes=%d edges=%d, want 3/2", len(g.Nodes), len(g.Edges))
	}

	// MarkCanon(all) promotes draft edges too.
	draftEdge, _, _ := tl.CreateEdge(ctx, john.ID, "family", guild.ID, "", AuthorAI)
	if _, err := tl.MarkCanon(ctx, john.ID, CanonScope{}); err != nil {
		t.Fatalf("MarkCanon: %v", err)
	}
	johnFull, _ = tl.GetEntry(ctx, john.ID)
	for _, sec := range johnFull.Relations {
		for _, e := range sec.Edges {
			if e.ID == draftEdge.ID && e.Status != StatusCanon {
				t.Errorf("edge not promoted by MarkCanon: %+v", e)
			}
		}
	}
}
