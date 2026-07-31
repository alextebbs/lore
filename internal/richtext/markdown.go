package richtext

import "strings"

// FromMarkdown parses the supported Markdown subset (with {~draft}
// markers) into a doc.
func FromMarkdown(md string) Node {
	md = strings.ReplaceAll(md, "\r\n", "\n")
	doc := Node{Type: "doc"}

	for _, block := range splitBlocks(md) {
		lines := strings.Split(block, "\n")
		switch {
		case isHeading(block):
			level := headingLevel(block)
			text := strings.TrimSpace(block[level+1:])
			doc.Content = append(doc.Content, Node{
				Type:    "heading",
				Attrs:   map[string]any{"level": level},
				Content: parseInline(text),
			})
		case isBulletList(lines):
			list := Node{Type: "bullet_list"}
			for _, line := range lines {
				item := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(line), "- "))
				list.Content = append(list.Content, Node{
					Type:    "list_item",
					Content: []Node{{Type: "paragraph", Content: parseInline(item)}},
				})
			}
			doc.Content = append(doc.Content, list)
		default:
			doc.Content = append(doc.Content, Node{
				Type:    "paragraph",
				Content: parseInline(strings.Join(lines, " ")),
			})
		}
	}
	return doc
}

func splitBlocks(md string) []string {
	var blocks []string
	for _, b := range strings.Split(md, "\n\n") {
		b = strings.TrimSpace(b)
		if b != "" {
			blocks = append(blocks, b)
		}
	}
	return blocks
}

func isHeading(block string) bool {
	l := headingLevel(block)
	return l >= 1 && l <= 3 && len(block) > l && block[l] == ' ' && !strings.Contains(block, "\n")
}

func headingLevel(block string) int {
	n := 0
	for n < len(block) && block[n] == '#' {
		n++
	}
	return n
}

func isBulletList(lines []string) bool {
	for _, l := range lines {
		if !strings.HasPrefix(strings.TrimSpace(l), "- ") {
			return false
		}
	}
	return len(lines) > 0
}

// parseInline tokenizes text with **bold**, *italic*, and draft markers
// into text nodes. Delimiters toggle state; draft spans may cross other
// marks freely.
func parseInline(s string) []Node {
	var nodes []Node
	var buf strings.Builder
	var bold, italic, draft bool

	flush := func() {
		if buf.Len() == 0 {
			return
		}
		n := Node{Type: "text", Text: buf.String()}
		if draft {
			n.Marks = append(n.Marks, Mark{Type: MarkDraft})
		}
		if bold {
			n.Marks = append(n.Marks, Mark{Type: MarkBold})
		}
		if italic {
			n.Marks = append(n.Marks, Mark{Type: MarkItalic})
		}
		nodes = append(nodes, n)
		buf.Reset()
	}

	for i := 0; i < len(s); {
		switch {
		case strings.HasPrefix(s[i:], DraftOpen):
			flush()
			draft = true
			i += len(DraftOpen)
		case strings.HasPrefix(s[i:], DraftClose):
			flush()
			draft = false
			i += len(DraftClose)
		case strings.HasPrefix(s[i:], "**"):
			flush()
			bold = !bold
			i += 2
		case s[i] == '*':
			flush()
			italic = !italic
			i++
		default:
			buf.WriteByte(s[i])
			i++
		}
	}
	flush()
	return nodes
}

// ToMarkdown renders a doc back to Markdown. When withDraftMarkers is
// false (export), draft spans render as plain text (SPEC: markers are
// not reflected after export).
func ToMarkdown(doc Node, withDraftMarkers bool) string {
	var blocks []string
	for _, b := range doc.Content {
		switch b.Type {
		case "heading":
			level := 1
			if l, ok := b.Attrs["level"].(float64); ok {
				level = int(l)
			} else if l, ok := b.Attrs["level"].(int); ok {
				level = l
			}
			blocks = append(blocks, strings.Repeat("#", level)+" "+renderInline(b.Content, withDraftMarkers))
		case "bullet_list":
			var lines []string
			for _, item := range b.Content {
				var inline []Node
				for _, p := range item.Content {
					inline = append(inline, p.Content...)
				}
				lines = append(lines, "- "+renderInline(inline, withDraftMarkers))
			}
			blocks = append(blocks, strings.Join(lines, "\n"))
		default:
			blocks = append(blocks, renderInline(b.Content, withDraftMarkers))
		}
	}
	return strings.Join(blocks, "\n\n")
}

// renderInline emits text runs, closing and reopening delimiters when the
// mark state changes between consecutive nodes. Canonical order:
// draft > bold > italic.
func renderInline(nodes []Node, withDraftMarkers bool) string {
	var sb strings.Builder
	var draft, bold, italic bool

	closeAll := func() {
		if italic {
			sb.WriteString("*")
			italic = false
		}
		if bold {
			sb.WriteString("**")
			bold = false
		}
		if draft {
			sb.WriteString(DraftClose)
			draft = false
		}
	}

	for _, n := range nodes {
		if n.Type != "text" {
			continue
		}
		wantDraft := n.hasMark(MarkDraft) && withDraftMarkers
		wantBold := n.hasMark(MarkBold)
		wantItalic := n.hasMark(MarkItalic)

		if wantDraft != draft || wantBold != bold || wantItalic != italic {
			closeAll()
			if wantDraft {
				sb.WriteString(DraftOpen)
				draft = true
			}
			if wantBold {
				sb.WriteString("**")
				bold = true
			}
			if wantItalic {
				sb.WriteString("*")
				italic = true
			}
		}
		sb.WriteString(n.Text)
	}
	closeAll()
	return sb.String()
}
