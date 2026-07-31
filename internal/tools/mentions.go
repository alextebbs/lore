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

const (
	MentionField = "mentions"
	// RelatedField is the universal untyped relationship available on
	// every entry regardless of schema.
	RelatedField = "related"
)

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

// propagateRename rewrites [[Old Title]] to [[New Title]] in every entry
// that mentions the renamed one — located by the mention edges (IDs),
// not text search — then refreshes their derived rows and mention edges.
func (t *Tools) propagateRename(ctx context.Context, q *db.Queries, renamed db.Entry, oldTitle, newTitle string) error {
	inbound, err := q.ListMentionEdgesTo(ctx, renamed.ID)
	if err != nil {
		return err
	}
	oldLink, newLink := "[["+oldTitle+"]]", "[["+newTitle+"]]"
	for _, e := range inbound {
		src, err := q.GetEntry(ctx, e.FromEntry)
		if err != nil {
			continue
		}
		changed := false

		if doc, err := richtext.ParseDoc(src.Body); err == nil {
			var rewrite func(n richtext.Node) richtext.Node
			rewrite = func(n richtext.Node) richtext.Node {
				if n.Type == "text" && strings.Contains(n.Text, oldLink) {
					n.Text = strings.ReplaceAll(n.Text, oldLink, newLink)
					changed = true
				}
				for i, c := range n.Content {
					n.Content[i] = rewrite(c)
				}
				return n
			}
			doc = rewrite(doc)
			if changed {
				if src.Body, err = json.Marshal(doc); err != nil {
					return err
				}
			}
		}

		fields := map[string]FieldValue{}
		if err := json.Unmarshal(src.Fields, &fields); err == nil {
			fieldsChanged := false
			for name, fv := range fields {
				switch v := fv.Value.(type) {
				case string:
					if strings.Contains(v, oldLink) {
						fv.Value = strings.ReplaceAll(v, oldLink, newLink)
						fields[name] = fv
						fieldsChanged = true
					}
				case []any:
					for i, item := range v {
						if s, ok := item.(string); ok && strings.Contains(s, oldLink) {
							v[i] = strings.ReplaceAll(s, oldLink, newLink)
							fieldsChanged = true
						}
					}
					if fieldsChanged {
						fields[name] = fv
					}
				}
			}
			if fieldsChanged {
				changed = true
				if src.Fields, err = json.Marshal(fields); err != nil {
					return err
				}
			}
		}

		if !changed {
			continue
		}
		updated, err := q.UpdateEntry(ctx, db.UpdateEntryParams{
			ID: src.ID, Title: src.Title, Fields: src.Fields,
			Body: src.Body, Status: src.Status,
		})
		if err != nil {
			return err
		}
		srcType, err := q.GetEntryType(ctx, updated.TypeID)
		if err != nil {
			return err
		}
		if err := t.refreshDerived(ctx, q, updated, srcType.Name); err != nil {
			return err
		}
		author := AuthorHuman
		if e.Status == StatusDraft {
			author = AuthorAI
		}
		if err := t.syncMentions(ctx, q, updated, author); err != nil {
			return err
		}
	}
	return nil
}
