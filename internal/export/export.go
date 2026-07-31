// Package export renders world content as an Obsidian-style vault
// (SPEC): one .md file per entry with YAML frontmatter for fields and
// [[wikilinks]] for relations, folders per type. Draft markers are
// stripped on export — the vault is clean Markdown.
package export

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/alextebbs/lore/internal/tools"
)

// RenderEntry renders one entry as vault Markdown.
func RenderEntry(e tools.Entry) string {
	var sb strings.Builder

	// YAML frontmatter: identity + plain fields.
	sb.WriteString("---\n")
	fmt.Fprintf(&sb, "id: %s\ntype: %s\nstatus: %s\n", e.ID, e.TypeName, e.Status)
	for name, fv := range e.Fields {
		v := fmt.Sprintf("%v", fv.Value)
		if strings.ContainsAny(v, ":#{}[]|>&*!%@`\"'\n") {
			v = fmt.Sprintf("%q", v)
		}
		fmt.Fprintf(&sb, "%s: %s\n", name, v)
	}
	sb.WriteString("---\n\n")

	fmt.Fprintf(&sb, "# %s\n\n", e.Title)

	for _, sec := range e.Relations {
		if len(sec.Edges) == 0 {
			continue
		}
		fmt.Fprintf(&sb, "**%s:** ", sec.Field)
		links := make([]string, 0, len(sec.Edges))
		for _, edge := range sec.Edges {
			l := "[[" + edge.To.Title + "]]"
			if edge.Annotation != "" {
				l += " (" + edge.Annotation + ")"
			}
			links = append(links, l)
		}
		sb.WriteString(strings.Join(links, ", ") + "\n\n")
	}
	for _, sec := range e.Reverse {
		fmt.Fprintf(&sb, "**%s:** ", sec.Label)
		links := make([]string, 0, len(sec.Items))
		for _, item := range sec.Items {
			l := "[[" + item.From.Title + "]]"
			if item.Annotation != "" {
				l += " (" + item.Annotation + ")"
			}
			links = append(links, l)
		}
		sb.WriteString(strings.Join(links, ", ") + "\n\n")
	}

	if body := exportBody(e); body != "" {
		sb.WriteString(body + "\n")
	}
	return sb.String()
}

// exportBody renders the body without draft markers (SPEC: markers are
// not reflected after export).
func exportBody(e tools.Entry) string {
	// BodyMD carries {~draft}...{/~}; strip the markers, keep the text.
	body := strings.ReplaceAll(e.BodyMD, "{~draft}", "")
	return strings.ReplaceAll(body, "{/~}", "")
}

var unsafeChars = regexp.MustCompile(`[<>:"/\\|?*#^\[\]]`)

// SafeFilename converts a title into a vault-safe filename.
func SafeFilename(title string) string {
	s := unsafeChars.ReplaceAllString(title, "")
	s = strings.TrimSpace(s)
	if s == "" {
		s = "untitled"
	}
	return s
}

// File is one rendered vault file.
type File struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// BuildVault renders every entry in a world into folder-per-type files.
func BuildVault(ctx context.Context, t *tools.Tools, worldID string) ([]File, error) {
	world, err := t.GetWorld(ctx, worldID)
	if err != nil {
		return nil, err
	}
	entries, err := t.ListEntries(ctx, worldID)
	if err != nil {
		return nil, err
	}

	var files []File
	usedPaths := map[string]int{}
	for _, summary := range entries {
		e, err := t.GetEntry(ctx, summary.ID)
		if err != nil {
			return nil, err
		}
		path := fmt.Sprintf("%s/%s.md", SafeFilename(e.TypeName), SafeFilename(e.Title))
		if n := usedPaths[path]; n > 0 {
			path = fmt.Sprintf("%s/%s %d.md", SafeFilename(e.TypeName), SafeFilename(e.Title), n+1)
		}
		usedPaths[fmt.Sprintf("%s/%s.md", SafeFilename(e.TypeName), SafeFilename(e.Title))]++
		files = append(files, File{Path: path, Content: RenderEntry(e)})
	}

	readme := fmt.Sprintf("# %s\n\nExported from Lore — %d entries.\n", world.Name, len(entries))
	files = append(files, File{Path: "README.md", Content: readme})
	return files, nil
}

// Zip packs vault files into a zip archive.
func Zip(files []File) ([]byte, error) {
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, f := range files {
		w, err := zw.Create(f.Path)
		if err != nil {
			return nil, err
		}
		if _, err := w.Write([]byte(f.Content)); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
