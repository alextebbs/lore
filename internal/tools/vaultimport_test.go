package tools

import "testing"

// The importer must round-trip the exporter's own format: frontmatter,
// blank line, # Title, relation list lines, then prose.
func TestParseVaultFileExportFormat(t *testing.T) {
	content := `---
id: abc
type: Character
status: mixed
gender: female
occupation: "lens-grinder"
---

# Signe Glasseye

**hometown:** [[Emberlight]]

**family:** [[Sarl Emberlight]] (second cousins), [[Kettil]] (father)

Signe grinds dune-glass into lenses that the [[Union]] sells.

Second paragraph.`
	ve := parseVaultFile(VaultFile{Path: "Character/Signe Glasseye.md", Content: content})
	if ve.title != "Signe Glasseye" {
		t.Errorf("title = %q", ve.title)
	}
	if ve.typeName != "Character" {
		t.Errorf("type = %q", ve.typeName)
	}
	if ve.status != StatusDraft { // mixed collapses to draft
		t.Errorf("status = %q", ve.status)
	}
	if ve.fields["gender"] != "female" || ve.fields["occupation"] != "lens-grinder" {
		t.Errorf("fields = %v", ve.fields)
	}
	if len(ve.rels) != 3 {
		t.Fatalf("rels = %v", ve.rels)
	}
	if ve.rels[0] != [3]string{"hometown", "Emberlight", ""} {
		t.Errorf("rel0 = %v", ve.rels[0])
	}
	if ve.rels[2] != [3]string{"family", "Kettil", "father"} {
		t.Errorf("rel2 = %v", ve.rels[2])
	}
	if !contains(ve.body, "Signe grinds") || contains(ve.body, "hometown") {
		t.Errorf("body = %q", ve.body)
	}
}

func contains(s, sub string) bool { return len(s) >= len(sub) && (s == sub || len(sub) == 0 || indexOf(s, sub) >= 0) }
func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
