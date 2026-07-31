package richtext

import (
	"reflect"
	"testing"
)

func TestMarkdownRoundTrip(t *testing.T) {
	// in == want for canonical inputs; overlapping marks normalize to
	// canonical order (draft > bold > italic), so those differ.
	cases := []struct{ in, want string }{
		{"Just a paragraph.", "Just a paragraph."},
		{"# Title\n\nBody text here.", "# Title\n\nBody text here."},
		{"## Section\n\nWith **bold** and *italic* runs.", "## Section\n\nWith **bold** and *italic* runs."},
		{"Zara rules the coast. {~draft}She fears the sea god.{/~}", "Zara rules the coast. {~draft}She fears the sea god.{/~}"},
		{"{~draft}An entirely draft paragraph.{/~}", "{~draft}An entirely draft paragraph.{/~}"},
		{"Mixed **bold {~draft}draft-bold{/~}** tail.", "Mixed **bold {~draft}draft-bold**{/~} tail."},
		{"- first\n- second **strong**\n- {~draft}speculative item{/~}", "- first\n- second **strong**\n- {~draft}speculative item{/~}"},
		{"# H1\n\n## H2\n\n### H3\n\npara", "# H1\n\n## H2\n\n### H3\n\npara"},
		// CommonMark constructs (lore-1zb)
		{"1. first\n2. second", "1. first\n2. second"},
		{"A [link](https://example.com) here.", "A [link](https://example.com) here."},
		{"Inline `code` span.", "Inline `code` span."},
		{"```go\nfunc main() {}\n```", "```go\nfunc main() {}\n```"},
		{"> quoted wisdom\n> more wisdom", "> quoted wisdom more wisdom"},
		{"---", "---"},
		{"- outer\n  - inner one\n  - inner two", "- outer\n  - inner one\n  - inner two"},
		{"{~draft}Draft with a [link](https://x.io) inside.{/~}", "{~draft}Draft with a [link](https://x.io) inside.{/~}"},
	}
	for _, c := range cases {
		doc := FromMarkdown(c.in)
		out := ToMarkdown(doc, true)
		if out != c.want {
			t.Errorf("render:\n in: %q\ngot: %q\nwant: %q", c.in, out, c.want)
		}
		// canonical form must be a fixed point: md -> doc -> md stable
		doc2 := FromMarkdown(out)
		if !reflect.DeepEqual(doc, doc2) {
			t.Errorf("doc not stable through markdown for %q", c.in)
		}
		if again := ToMarkdown(doc2, true); again != out {
			t.Errorf("markdown not a fixed point: %q -> %q", out, again)
		}
	}
}

func TestExportStripsMarkers(t *testing.T) {
	doc := FromMarkdown("Canon text. {~draft}Draft text.{/~}")
	got := ToMarkdown(doc, false)
	want := "Canon text. Draft text."
	if got != want {
		t.Errorf("export = %q, want %q", got, want)
	}
}

func TestBodyState(t *testing.T) {
	cases := []struct {
		md   string
		want string
	}{
		{"", "none"},
		{"all canon", "canon"},
		{"{~draft}all draft{/~}", "draft"},
		{"canon {~draft}and draft{/~}", "mixed"},
	}
	for _, c := range cases {
		if got := BodyState(FromMarkdown(c.md)); got != c.want {
			t.Errorf("BodyState(%q) = %q, want %q", c.md, got, c.want)
		}
	}
}

func TestStripAndMarkAll(t *testing.T) {
	doc := FromMarkdown("canon {~draft}draft{/~}")
	if got := BodyState(StripDraftMarks(doc)); got != "canon" {
		t.Errorf("after strip: %q, want canon", got)
	}
	if got := BodyState(MarkAllDraft(doc)); got != "draft" {
		t.Errorf("after mark-all: %q, want draft", got)
	}
}
