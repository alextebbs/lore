package export

import (
	"strings"
	"testing"

	"github.com/alextebbs/lore/internal/tools"
)

func TestRenderEntry(t *testing.T) {
	e := tools.Entry{
		ID: "abc", TypeName: "Character", Title: "John Doe", Status: "canon",
		Fields: map[string]tools.FieldValue{
			"gender": {Value: "male", Status: "canon"},
		},
		BodyMD: "John rules. {~draft}He fears the sea god.{/~}",
		Relations: []tools.RelationSection{{
			Field: "hometown",
			Edges: []tools.Edge{{To: tools.EntryRef{Title: "Chicago"}}},
		}, {
			Field: "family", Label: "Family", Reverse: true,
			Edges: []tools.Edge{{
				To: tools.EntryRef{Title: "Jane Doe"}, Annotation: "older sister", Incoming: true,
			}},
		}},
	}
	md := RenderEntry(e)

	for _, want := range []string{
		"id: abc", "type: Character", "status: canon", "gender: male",
		"# John Doe",
		"**hometown:** [[Chicago]]",
		"**Family:** [[Jane Doe]] (older sister)",
		"John rules. He fears the sea god.",
	} {
		if !strings.Contains(md, want) {
			t.Errorf("missing %q in:\n%s", want, md)
		}
	}
	if strings.Contains(md, "{~draft}") || strings.Contains(md, "{/~}") {
		t.Errorf("draft markers leaked into export:\n%s", md)
	}
}

func TestSafeFilename(t *testing.T) {
	if got := SafeFilename(`Wh?at: a/we\ird "name"`); strings.ContainsAny(got, `<>:"/\|?*`) {
		t.Errorf("unsafe filename: %q", got)
	}
	if SafeFilename("///") != "untitled" {
		t.Errorf("empty-after-sanitize should be untitled")
	}
}
