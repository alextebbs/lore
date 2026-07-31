package richtext

import (
	"fmt"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/text"
)

// FromMarkdown parses CommonMark (via goldmark) into a doc, then applies
// {~draft} markers as a post-pass: markers may cross other marks and
// block boundaries; unclosed markers run to the end of the doc.
func FromMarkdown(md string) Node {
	md = strings.ReplaceAll(md, "\r\n", "\n")
	source := []byte(md)
	root := goldmark.DefaultParser().Parse(text.NewReader(source))
	doc := Node{Type: "doc"}
	for child := root.FirstChild(); child != nil; child = child.NextSibling() {
		if n, ok := blockFromAST(child, source); ok {
			doc.Content = append(doc.Content, n)
		}
	}
	return normalize(applyDraftMarkers(doc))
}

// normalize drops empty text nodes and merges adjacent text runs with
// identical marks (parse artifacts like soft-break spaces).
func normalize(n Node) Node {
	if len(n.Marks) == 0 {
		n.Marks = nil
	}
	var content []Node
	for _, c := range n.Content {
		c = normalize(c)
		if c.Type == "text" && c.Text == "" {
			continue
		}
		if len(content) > 0 {
			prev := &content[len(content)-1]
			if prev.Type == "text" && c.Type == "text" && marksEqual(prev.Marks, c.Marks) {
				prev.Text += c.Text
				continue
			}
		}
		content = append(content, c)
	}
	n.Content = content
	return n
}

func marksEqual(a, b []Mark) bool {
	if len(a) != len(b) {
		return false
	}
	key := func(marks []Mark) string {
		parts := make([]string, 0, len(marks))
		for _, m := range marks {
			k := m.Type
			if h, ok := m.Attrs["href"].(string); ok {
				k += ":" + h
			}
			parts = append(parts, k)
		}
		sortStrings(parts)
		return strings.Join(parts, "|")
	}
	return key(a) == key(b)
}

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j] < s[j-1]; j-- {
			s[j], s[j-1] = s[j-1], s[j]
		}
	}
}

func blockFromAST(n ast.Node, src []byte) (Node, bool) {
	switch v := n.(type) {
	case *ast.Paragraph, *ast.TextBlock:
		return Node{Type: "paragraph", Content: inlineFromAST(n, src, nil)}, true
	case *ast.Heading:
		level := v.Level
		if level > 3 {
			level = 3
		}
		return Node{
			Type:    "heading",
			Attrs:   map[string]any{"level": level},
			Content: inlineFromAST(n, src, nil),
		}, true
	case *ast.List:
		typ := "bullet_list"
		if v.IsOrdered() {
			typ = "ordered_list"
		}
		list := Node{Type: typ}
		for item := n.FirstChild(); item != nil; item = item.NextSibling() {
			li := Node{Type: "list_item"}
			for blk := item.FirstChild(); blk != nil; blk = blk.NextSibling() {
				if b, ok := blockFromAST(blk, src); ok {
					li.Content = append(li.Content, b)
				}
			}
			list.Content = append(list.Content, li)
		}
		return list, true
	case *ast.FencedCodeBlock, *ast.CodeBlock:
		var sb strings.Builder
		lines := n.Lines()
		for i := 0; i < lines.Len(); i++ {
			seg := lines.At(i)
			sb.Write(seg.Value(src))
		}
		node := Node{Type: "code_block"}
		if fc, ok := n.(*ast.FencedCodeBlock); ok && fc.Info != nil {
			node.Attrs = map[string]any{"language": string(fc.Info.Segment.Value(src))}
		}
		code := strings.TrimSuffix(sb.String(), "\n")
		if code != "" {
			node.Content = []Node{{Type: "text", Text: code}}
		}
		return node, true
	case *ast.Blockquote:
		bq := Node{Type: "blockquote"}
		for blk := n.FirstChild(); blk != nil; blk = blk.NextSibling() {
			if b, ok := blockFromAST(blk, src); ok {
				bq.Content = append(bq.Content, b)
			}
		}
		return bq, true
	case *ast.ThematicBreak:
		return Node{Type: "horizontal_rule"}, true
	}
	return Node{}, false
}

// inlineFromAST flattens an inline tree into text nodes with marks.
func inlineFromAST(parent ast.Node, src []byte, marks []Mark) []Node {
	var out []Node
	push := func(text string, extra ...Mark) {
		if text == "" {
			return
		}
		all := append(append([]Mark{}, marks...), extra...)
		out = append(out, Node{Type: "text", Text: text, Marks: dedupeMarks(all)})
	}
	for c := parent.FirstChild(); c != nil; c = c.NextSibling() {
		switch v := c.(type) {
		case *ast.Text:
			push(string(v.Segment.Value(src)))
			if v.SoftLineBreak() || v.HardLineBreak() {
				push(" ")
			}
		case *ast.String:
			push(string(v.Value))
		case *ast.Emphasis:
			m := Mark{Type: MarkItalic}
			if v.Level >= 2 {
				m = Mark{Type: MarkBold}
			}
			out = append(out, inlineFromAST(c, src, append(append([]Mark{}, marks...), m))...)
		case *ast.CodeSpan:
			var sb strings.Builder
			for t := c.FirstChild(); t != nil; t = t.NextSibling() {
				if txt, ok := t.(*ast.Text); ok {
					sb.Write(txt.Segment.Value(src))
				}
			}
			push(sb.String(), Mark{Type: MarkCode})
		case *ast.Link:
			m := Mark{Type: MarkLink, Attrs: map[string]any{"href": string(v.Destination)}}
			out = append(out, inlineFromAST(c, src, append(append([]Mark{}, marks...), m))...)
		case *ast.AutoLink:
			url := string(v.URL(src))
			push(url, Mark{Type: MarkLink, Attrs: map[string]any{"href": url}})
		case *ast.RawHTML:
			// keep raw HTML as literal text (lossless, not interpreted)
			var sb strings.Builder
			for i := 0; i < v.Segments.Len(); i++ {
				seg := v.Segments.At(i)
				sb.Write(seg.Value(src))
			}
			push(sb.String())
		default:
			// unknown inline containers: recurse; leaves: skip
			if c.HasChildren() {
				out = append(out, inlineFromAST(c, src, marks)...)
			}
		}
	}
	return out
}

func dedupeMarks(marks []Mark) []Mark {
	var out []Mark
	seen := map[string]bool{}
	for _, m := range marks {
		if !seen[m.Type] {
			seen[m.Type] = true
			out = append(out, m)
		}
	}
	return out
}

// applyDraftMarkers splits text nodes on {~draft} / {/~}, applying the
// draft mark between them. State carries across nodes and blocks.
func applyDraftMarkers(doc Node) Node {
	draft := false
	var walk func(Node) Node
	walk = func(n Node) Node {
		if n.Type == "text" {
			// fast path: no markers
			if !strings.Contains(n.Text, DraftOpen) && !strings.Contains(n.Text, DraftClose) {
				if draft && !n.hasMark(MarkDraft) {
					n.Marks = append([]Mark{{Type: MarkDraft}}, n.Marks...)
				}
				return n
			}
			// split into runs; represent the result as a wrapper whose
			// content the parent will splice in
			var runs []Node
			rest := n.Text
			for rest != "" {
				io := strings.Index(rest, DraftOpen)
				ic := strings.Index(rest, DraftClose)
				next, tok := -1, ""
				if io >= 0 && (ic < 0 || io < ic) {
					next, tok = io, DraftOpen
				} else if ic >= 0 {
					next, tok = ic, DraftClose
				}
				if next == -1 {
					runs = append(runs, textRun(rest, n.Marks, draft))
					break
				}
				runs = append(runs, textRun(rest[:next], n.Marks, draft))
				draft = tok == DraftOpen
				rest = rest[next+len(tok):]
			}
			return Node{Type: "__runs__", Content: runs}
		}
		var content []Node
		for _, c := range n.Content {
			r := walk(c)
			if r.Type == "__runs__" {
				content = append(content, r.Content...)
			} else {
				content = append(content, r)
			}
		}
		n.Content = content
		return n
	}
	return walk(doc)
}

func textRun(text string, base []Mark, draft bool) Node {
	if text == "" {
		return Node{Type: "text", Text: ""}
	}
	n := Node{Type: "text", Text: text, Marks: append([]Mark{}, base...)}
	if draft && !n.hasMark(MarkDraft) {
		n.Marks = append([]Mark{{Type: MarkDraft}}, n.Marks...)
	}
	return n
}

// ToMarkdown renders a doc back to Markdown. When withDraftMarkers is
// false (export), draft spans render as plain text.
func ToMarkdown(doc Node, withDraftMarkers bool) string {
	var blocks []string
	for _, b := range doc.Content {
		if s := renderBlock(b, withDraftMarkers); s != "" {
			blocks = append(blocks, s)
		}
	}
	return strings.Join(blocks, "\n\n")
}

func renderBlock(b Node, markers bool) string {
	switch b.Type {
	case "heading":
		level := 1
		switch l := b.Attrs["level"].(type) {
		case float64:
			level = int(l)
		case int:
			level = l
		}
		return strings.Repeat("#", level) + " " + renderInline(b.Content, markers)
	case "bullet_list", "ordered_list":
		var lines []string
		for i, item := range b.Content {
			prefix := "- "
			if b.Type == "ordered_list" {
				prefix = fmt.Sprintf("%d. ", i+1)
			}
			lines = append(lines, renderListItem(item, prefix, markers))
		}
		return strings.Join(lines, "\n")
	case "code_block":
		lang := ""
		if l, ok := b.Attrs["language"].(string); ok {
			lang = l
		}
		var code string
		if len(b.Content) > 0 {
			code = b.Content[0].Text
		}
		return "```" + lang + "\n" + code + "\n```"
	case "blockquote":
		var inner []string
		for _, c := range b.Content {
			if s := renderBlock(c, markers); s != "" {
				inner = append(inner, s)
			}
		}
		joined := strings.Join(inner, "\n\n")
		var quoted []string
		for _, line := range strings.Split(joined, "\n") {
			quoted = append(quoted, strings.TrimRight("> "+line, " "))
		}
		return strings.Join(quoted, "\n")
	case "horizontal_rule":
		return "---"
	default: // paragraph
		return renderInline(b.Content, markers)
	}
}

// renderListItem renders a list_item's blocks; the first paragraph goes
// on the marker line, nested blocks are indented.
func renderListItem(item Node, prefix string, markers bool) string {
	indent := strings.Repeat(" ", len(prefix))
	var lines []string
	first := true
	for _, blk := range item.Content {
		s := renderBlock(blk, markers)
		if s == "" {
			continue
		}
		if first {
			lines = append(lines, prefix+strings.ReplaceAll(s, "\n", "\n"+indent))
			first = false
		} else {
			for _, l := range strings.Split(s, "\n") {
				lines = append(lines, indent+l)
			}
		}
	}
	if len(lines) == 0 {
		return strings.TrimRight(prefix, " ")
	}
	return strings.Join(lines, "\n")
}

// renderInline emits text runs. Structural marks (link/bold/italic/code)
// close and reopen when their state changes; draft markers are plain
// inline tokens that never disturb the structural nesting — they can sit
// inside emphasis or link text, exactly as they parse.
func renderInline(nodes []Node, withDraftMarkers bool) string {
	var sb strings.Builder
	type state struct {
		bold, italic, code bool
		href               string
		linkText           strings.Builder
	}
	var st state
	draft := false

	target := func() *strings.Builder {
		if st.href != "" {
			return &st.linkText
		}
		return &sb
	}
	closeStructural := func() {
		w := target()
		if st.code {
			w.WriteString("`")
			st.code = false
		}
		if st.italic {
			w.WriteString("*")
			st.italic = false
		}
		if st.bold {
			w.WriteString("**")
			st.bold = false
		}
		if st.href != "" {
			link := "[" + st.linkText.String() + "](" + st.href + ")"
			st.href = ""
			st.linkText.Reset()
			sb.WriteString(link)
		}
	}

	for _, n := range nodes {
		if n.Type != "text" || n.Text == "" {
			continue
		}
		wantDraft := n.hasMark(MarkDraft) && withDraftMarkers
		wantBold := n.hasMark(MarkBold)
		wantItalic := n.hasMark(MarkItalic)
		wantCode := n.hasMark(MarkCode)
		wantHref := ""
		for _, m := range n.Marks {
			if m.Type == MarkLink {
				if h, ok := m.Attrs["href"].(string); ok {
					wantHref = h
				}
			}
		}

		if wantBold != st.bold || wantItalic != st.italic ||
			wantCode != st.code || wantHref != st.href {
			closeStructural()
			if wantHref != "" {
				st.href = wantHref
			}
			w := target()
			if wantBold {
				w.WriteString("**")
				st.bold = true
			}
			if wantItalic {
				w.WriteString("*")
				st.italic = true
			}
			if wantCode {
				w.WriteString("`")
				st.code = true
			}
		}
		if wantDraft != draft {
			if wantDraft {
				target().WriteString(DraftOpen)
			} else {
				target().WriteString(DraftClose)
			}
			draft = wantDraft
		}
		target().WriteString(n.Text)
	}
	if draft {
		target().WriteString(DraftClose)
	}
	closeStructural()
	return sb.String()
}
