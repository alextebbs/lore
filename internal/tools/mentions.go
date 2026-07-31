package tools

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"encoding/json"

	"github.com/alextebbs/lore/internal/richtext"
	"github.com/alextebbs/lore/internal/store/db"
)

func jsonUnmarshal(raw []byte, v any) error { return json.Unmarshal(raw, v) }

// Mentions: [[Entry Title]] links inside body text or rich-text fields
// establish system-managed edges (field "mentions") annotated
// "mentioned in <section> of <entry>". They resync on every write and
// surface on the target as a "Mentioned in" reverse section.

const MentionField = "mentions"

var mentionRe = regexp.MustCompile(`\[\[([^\[\]{}]+)\]\]`)

type mention struct {
	title   string
	section string
}

// collectMentions scans an entry's body and field values.
func collectMentions(row db.Entry) []mention {
	var out []mention
	seen := map[string]bool{}
	add := func(text, section string) {
		for _, m := range mentionRe.FindAllStringSubmatch(text, -1) {
			title := strings.TrimSpace(m[1])
			key := strings.ToLower(title) + "\x00" + section
			if title != "" && !seen[key] {
				seen[key] = true
				out = append(out, mention{title: title, section: section})
			}
		}
	}
	if doc, err := richtext.ParseDoc(row.Body); err == nil {
		add(richtext.ToMarkdown(doc, false), "body")
	}
	fields := map[string]FieldValue{}
	if err := jsonUnmarshal(row.Fields, &fields); err == nil {
		for name, fv := range fields {
			switch v := fv.Value.(type) {
			case string:
				add(v, name)
			case []any:
				for _, item := range v {
					if s, ok := item.(string); ok {
						add(s, name)
					}
				}
			}
		}
	}
	return out
}

// syncMentions rebuilds an entry's mention edges from its content.
// Mention edges inherit the author's status semantics (AI draft,
// human per world policy).
func (t *Tools) syncMentions(ctx context.Context, q *db.Queries, row db.Entry, author Author) error {
	if err := q.DeleteEdgesByField(ctx, db.DeleteEdgesByFieldParams{
		FromEntry: row.ID, Field: MentionField,
	}); err != nil {
		return err
	}
	settings := WorldSettings{}
	if w, err := q.GetWorld(ctx, row.WorldID); err == nil {
		settings = parseSettings(w.Settings)
	}
	status := StatusDraft
	if author == AuthorHuman {
		status = settings.humanStatus()
	}
	for _, m := range collectMentions(row) {
		target, err := q.GetEntryByTitle(ctx, db.GetEntryByTitleParams{
			WorldID: row.WorldID, Lower: m.title,
		})
		if err != nil || target == row.ID {
			continue // unresolved titles are fine — link later
		}
		section := m.section
		if section != "body" {
			section = strings.ReplaceAll(section, "_", " ")
		}
		if _, err := q.CreateEdge(ctx, db.CreateEdgeParams{
			ID: newID(), WorldID: row.WorldID, FromEntry: row.ID,
			Field: MentionField, ToEntry: target,
			Annotation: fmt.Sprintf("mentioned in %s of %s", section, row.Title),
			Status:     status,
		}); err != nil {
			return err
		}
	}
	return nil
}
