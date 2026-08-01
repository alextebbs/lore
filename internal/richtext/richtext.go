// Package richtext owns the structured rich-text document model and its
// Markdown boundary (ADR 0001). Postgres stores docs; the API and agents
// speak Markdown where draft/canon spans appear as {~draft}...{/~}
// markers. Conversion happens here and only here.
//
// v0 covers: paragraphs, headings 1–3, bullet lists, bold, italic, and
// the draft mark. Full CommonMark is a tracked follow-up.
package richtext

import (
	"encoding/json"
	"fmt"
	"strings"
)

const (
	MarkBold   = "bold"
	MarkItalic = "italic"
	MarkDraft  = "draft"
	MarkCode   = "code"
	MarkLink   = "link"

	DraftOpen  = "{~draft}"
	DraftClose = "{/~}"
)

type Mark struct {
	Type  string         `json:"type"`
	Attrs map[string]any `json:"attrs,omitempty"` // link: {href}
}

type Node struct {
	Type    string         `json:"type"`
	Text    string         `json:"text,omitempty"`
	Marks   []Mark         `json:"marks,omitempty"`
	Attrs   map[string]any `json:"attrs,omitempty"`
	Content []Node         `json:"content,omitempty"`
}

func EmptyDoc() Node {
	return Node{Type: "doc"}
}

func ParseDoc(raw []byte) (Node, error) {
	var doc Node
	if err := json.Unmarshal(raw, &doc); err != nil {
		return Node{}, fmt.Errorf("parsing rich-text doc: %w", err)
	}
	if doc.Type != "doc" {
		return Node{}, fmt.Errorf("rich-text root must be doc, got %q", doc.Type)
	}
	return doc, nil
}

func (n Node) hasMark(mark string) bool {
	for _, m := range n.Marks {
		if m.Type == mark {
			return true
		}
	}
	return false
}

var (
	allowedNodes = map[string]bool{
		"doc": true, "paragraph": true, "heading": true,
		"bullet_list": true, "ordered_list": true, "list_item": true,
		"code_block": true, "blockquote": true, "horizontal_rule": true,
		"text": true, "mention": true,
	}
	allowedMarks = map[string]bool{
		MarkBold: true, MarkItalic: true, MarkDraft: true,
		MarkCode: true, MarkLink: true,
	}
)

// Validate rejects docs containing node or mark types outside the
// supported set — the one hard check on client-supplied docs.
func Validate(doc Node) error {
	var walk func(Node) error
	walk = func(n Node) error {
		if !allowedNodes[n.Type] {
			return fmt.Errorf("unsupported node type %q", n.Type)
		}
		for _, m := range n.Marks {
			if !allowedMarks[m.Type] {
				return fmt.Errorf("unsupported mark type %q", m.Type)
			}
		}
		for _, c := range n.Content {
			if err := walk(c); err != nil {
				return err
			}
		}
		return nil
	}
	return walk(doc)
}

// BodyState reports the draft/canon composition of a doc's text:
// "none" (no text), "canon", "draft", or "mixed".
func BodyState(doc Node) string {
	var canon, draft bool
	var walk func(Node)
	walk = func(n Node) {
		if n.Type == "text" && strings.TrimSpace(n.Text) != "" {
			if n.hasMark(MarkDraft) {
				draft = true
			} else {
				canon = true
			}
		}
		for _, c := range n.Content {
			walk(c)
		}
	}
	walk(doc)
	switch {
	case canon && draft:
		return "mixed"
	case draft:
		return "draft"
	case canon:
		return "canon"
	default:
		return "none"
	}
}

// StripDraftMarks returns the doc with every draft mark removed —
// the bulk "mark canon" operation on a body.
func StripDraftMarks(doc Node) Node {
	var walk func(Node) Node
	walk = func(n Node) Node {
		if len(n.Marks) > 0 {
			kept := n.Marks[:0:0]
			for _, m := range n.Marks {
				if m.Type != MarkDraft {
					kept = append(kept, m)
				}
			}
			n.Marks = kept
		}
		for i, c := range n.Content {
			n.Content[i] = walk(c)
		}
		return n
	}
	return walk(doc)
}

// MarkAllDraft returns the doc with every text node carrying the draft
// mark — how AI-authored bodies enter the world (tenet 4).
func MarkAllDraft(doc Node) Node {
	var walk func(Node) Node
	walk = func(n Node) Node {
		if n.Type == "text" && !n.hasMark(MarkDraft) {
			n.Marks = append(n.Marks, Mark{Type: MarkDraft})
		}
		for i, c := range n.Content {
			n.Content[i] = walk(c)
		}
		return n
	}
	return walk(doc)
}
