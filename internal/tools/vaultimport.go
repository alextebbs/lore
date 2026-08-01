package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"path"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/alextebbs/lore/internal/richtext"
	"github.com/alextebbs/lore/internal/store/db"
)

// Vault import: the inverse of the Obsidian export, tolerant of
// foreign vaults. Each .md file becomes an entry in the target world:
//   - frontmatter `type:` matches an existing type by name (or creates
//     a bare one, soft-schema style); missing type → the Lore type
//   - frontmatter `status:` is honored; absent → draft (bulk-imported
//     text deserves review before it's canon)
//   - other frontmatter keys become field values
//   - leading `**Label:** [[A]] (note), [[B]]` lines become edges,
//     resolved by title once every file has landed
//   - the remaining markdown is the body; [[wiki-links]] become
//     mention nodes through the normal pipeline
type VaultFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

type VaultImportResult struct {
	Created  int      `json:"created"`
	Skipped  []string `json:"skipped,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
}

var (
	relLineRe = regexp.MustCompile(`^\*\*([^*]+):\*\*\s*(.+)$`)
	relLinkRe = regexp.MustCompile(`\[\[([^\[\]]+)\]\](?:\s*\(([^)]*)\))?`)
	h1Re      = regexp.MustCompile(`^#\s+(.+)$`)
)

type vaultEntry struct {
	title    string
	typeName string
	status   string
	fields   map[string]string
	rels     [][3]string // field label, target title, annotation
	body     string
}

// parseVaultFile splits one markdown file into its parts.
func parseVaultFile(f VaultFile) vaultEntry {
	ve := vaultEntry{
		title:  strings.TrimSuffix(path.Base(f.Path), ".md"),
		status: StatusDraft,
		fields: map[string]string{},
	}
	lines := strings.Split(strings.ReplaceAll(f.Content, "\r\n", "\n"), "\n")
	i := 0

	// Frontmatter: flat key: value pairs; anything fancier is skipped.
	if len(lines) > 0 && strings.TrimSpace(lines[0]) == "---" {
		i = 1
		for i < len(lines) && strings.TrimSpace(lines[i]) != "---" {
			line := lines[i]
			i++
			k, v, ok := strings.Cut(line, ":")
			if !ok {
				continue
			}
			k = strings.TrimSpace(k)
			v = strings.TrimSpace(v)
			if uq, err := strconv.Unquote(v); err == nil {
				v = uq
			}
			switch strings.ToLower(k) {
			case "id": // foreign ids are meaningless here
			case "type":
				ve.typeName = v
			case "status":
				if v == StatusCanon {
					ve.status = StatusCanon
				}
			case "title":
				ve.title = v
			default:
				if k != "" && v != "" {
					ve.fields[k] = v
				}
			}
		}
		if i < len(lines) {
			i++ // closing ---
		}
	}

	var body []string
	titleTaken := false
	for ; i < len(lines); i++ {
		line := lines[i]
		trimmed := strings.TrimSpace(line)
		// Leading blank lines belong to nobody.
		if trimmed == "" && !hasProse(body) {
			if len(body) > 0 {
				body = append(body, line) // keep spacing between rel lines
			}
			continue
		}
		// The exporter writes `# Title` first — that's the title, not body.
		if !titleTaken && !hasProse(body) && h1Re.MatchString(trimmed) {
			ve.title = h1Re.FindStringSubmatch(trimmed)[1]
			titleTaken = true
			continue
		}
		// Relation list lines (only before any real prose).
		if m := relLineRe.FindStringSubmatch(trimmed); m != nil && !hasProse(body) {
			for _, link := range relLinkRe.FindAllStringSubmatch(m[2], -1) {
				ve.rels = append(ve.rels, [3]string{
					strings.TrimSpace(m[1]), strings.TrimSpace(link[1]), strings.TrimSpace(link[2]),
				})
			}
			continue
		}
		body = append(body, line)
	}
	ve.body = strings.TrimSpace(strings.Join(body, "\n"))
	return ve
}

func hasProse(body []string) bool {
	for _, l := range body {
		if strings.TrimSpace(l) != "" {
			return true
		}
	}
	return false
}

// ImportVault creates entries from vault files in an existing world.
// Titles that already exist are skipped (imports are additive, never
// destructive).
func (t *Tools) ImportVault(ctx context.Context, worldID string, files []VaultFile) (VaultImportResult, error) {
	wid, err := parseID(worldID)
	if err != nil {
		return VaultImportResult{}, err
	}
	world, err := t.store.Queries.GetWorld(ctx, wid)
	if err != nil {
		return VaultImportResult{}, notFound(err)
	}
	if err := t.checkWorldOwner(world); err != nil {
		return VaultImportResult{}, err
	}

	var res VaultImportResult
	err = t.store.Tx(ctx, func(q *db.Queries) error {
		types, err := q.ListEntryTypes(ctx, wid)
		if err != nil {
			return err
		}
		typeByName := map[string]pgtype.UUID{}
		var loreType, worldType pgtype.UUID
		for _, ty := range types {
			typeByName[strings.ToLower(ty.Name)] = ty.ID
			if ty.Name == "Lore" {
				loreType = ty.ID
			}
			if ty.Name == "World" {
				worldType = ty.ID
			}
		}

		existing := map[string]bool{}
		rows, err := q.ListEntryRows(ctx, wid)
		if err != nil {
			return err
		}
		for _, r := range rows {
			existing[strings.ToLower(r.Title)] = true
		}

		var parsed []vaultEntry
		created := map[string]pgtype.UUID{}
		for _, f := range files {
			if !strings.HasSuffix(strings.ToLower(f.Path), ".md") {
				continue
			}
			ve := parseVaultFile(f)
			if ve.title == "" {
				res.Skipped = append(res.Skipped, f.Path+" (no title)")
				continue
			}
			if existing[strings.ToLower(ve.title)] {
				res.Skipped = append(res.Skipped, ve.title+" (title exists)")
				continue
			}

			tid := loreType
			if ve.typeName != "" {
				if id, ok := typeByName[strings.ToLower(ve.typeName)]; ok {
					if id == worldType {
						// Never import a second World meta entry.
						res.Skipped = append(res.Skipped, ve.title+" (World type)")
						continue
					}
					tid = id
				} else {
					nid := newID()
					if _, err := q.CreateEntryType(ctx, db.CreateEntryTypeParams{
						ID: nid, WorldID: wid, Name: ve.typeName,
						ParentID: pgtype.UUID{}, Fields: []byte("[]"), Builtin: false,
					}); err != nil {
						return fmt.Errorf("creating type %q: %w", ve.typeName, err)
					}
					typeByName[strings.ToLower(ve.typeName)] = nid
					tid = nid
					res.Warnings = append(res.Warnings,
						fmt.Sprintf("created type %q (no fields) for %q", ve.typeName, ve.title))
				}
			}

			fields := map[string]FieldValue{}
			for k, v := range ve.fields {
				fields[k] = FieldValue{Value: v, Status: ve.status}
			}
			fieldsJSON, err := json.Marshal(fields)
			if err != nil {
				return err
			}
			doc := richtext.FromMarkdown(ve.body)
			if ve.status != StatusCanon {
				doc = richtext.MarkAllDraft(doc)
			}
			bodyJSON, err := json.Marshal(doc)
			if err != nil {
				return err
			}
			id := newID()
			row, err := q.CreateEntry(ctx, db.CreateEntryParams{
				ID: id, WorldID: wid, TypeID: tid, Title: ve.title,
				Fields: fieldsJSON, Body: bodyJSON, Status: ve.status,
			})
			if err != nil {
				return fmt.Errorf("importing %q: %w", ve.title, err)
			}
			if err := recordRevision(ctx, q, row, AuthorHuman); err != nil {
				return err
			}
			existing[strings.ToLower(ve.title)] = true
			created[strings.ToLower(ve.title)] = id
			parsed = append(parsed, ve)
			res.Created++
		}

		// Second pass: resolve mentions/derived, then relation lines.
		titleToID := func(title string) (pgtype.UUID, bool) {
			if id, ok := created[strings.ToLower(title)]; ok {
				return id, true
			}
			id, err := q.GetEntryByTitle(ctx, db.GetEntryByTitleParams{
				WorldID: wid, Lower: strings.ToLower(title),
			})
			return id, err == nil
		}
		for _, ve := range parsed {
			id := created[strings.ToLower(ve.title)]
			row, err := q.GetEntry(ctx, id)
			if err != nil {
				return err
			}
			if doc, err := richtext.ParseDoc(row.Body); err == nil {
				doc = t.resolveMentionDoc(ctx, q, wid, doc)
				if raw, err := json.Marshal(doc); err == nil {
					if row, err = q.UpdateEntry(ctx, db.UpdateEntryParams{
						ID: row.ID, Title: row.Title, Fields: row.Fields,
						Body: raw, Status: row.Status,
					}); err != nil {
						return err
					}
				}
			}
			et, err := q.GetEntryType(ctx, row.TypeID)
			if err != nil {
				return err
			}
			if err := t.refreshDerived(ctx, q, row, et.Name); err != nil {
				return err
			}
			if err := t.syncMentions(ctx, q, row, AuthorHuman); err != nil {
				return err
			}
			eff, _ := t.effectiveFieldsQ(ctx, q, wid, row.TypeID)
			for _, rel := range ve.rels {
				// Mentions regenerate from [[links]] in bodies — the
				// exported "Mentioned in" lines are derived data.
				if strings.EqualFold(rel[0], "Mentioned in") {
					continue
				}
				target, ok := titleToID(rel[1])
				if !ok {
					res.Warnings = append(res.Warnings,
						fmt.Sprintf("%s: relation target %q not found", ve.title, rel[1]))
					continue
				}
				// Match the exported label back to a field: this type's
				// own field name → forward edge; a target-type field's
				// inverse label (the export of a reverse section) →
				// edge in its canonical direction (target→here); else
				// the universal related field.
				from, to := id, target
				field := RelatedField
				fieldID := SysRelatedFieldID
				want := strings.ToLower(strings.ReplaceAll(rel[0], " ", "_"))
				matched := false
				for _, def := range eff {
					if strings.ToLower(def.Name) == want {
						field, fieldID, matched = def.Name, def.ID, true
						break
					}
				}
				if !matched {
					if trow, err := q.GetEntry(ctx, target); err == nil {
						teff, _ := t.effectiveFieldsQ(ctx, q, wid, trow.TypeID)
						for _, def := range teff {
							if def.Relation != nil &&
								strings.EqualFold(def.Relation.InverseLabel, rel[0]) {
								from, to = target, id // canonical direction
								field, fieldID, matched = def.Name, def.ID, true
								break
							}
						}
					}
				}
				// Both endpoints export shared edges — create once.
				dup := false
				for _, pair := range [][2]pgtype.UUID{{from, to}, {to, from}} {
					existingEdges, err := q.ListEdgesFrom(ctx, pair[0])
					if err != nil {
						return err
					}
					for _, ee := range existingEdges {
						if ee.Field == field && ee.ToEntry == pair[1] {
							dup = true
						}
					}
				}
				if dup {
					continue
				}
				if _, err := q.CreateEdge(ctx, db.CreateEdgeParams{
					ID: newID(), WorldID: wid, FromEntry: from, Field: field,
					FieldID: fieldID, ToEntry: to,
					Annotation: rel[2], Status: ve.status,
				}); err != nil {
					return err
				}
			}
		}
		return nil
	})
	return res, err
}
