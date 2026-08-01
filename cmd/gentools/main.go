// gentools regenerates the capability table in docs/TOOLS.md from the
// tool registry (ADR 0016). Run via `make tools-docs`; the toolreg
// tests fail if the file is stale.
package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/alextebbs/lore/internal/toolreg"
)

func main() {
	path := "docs/TOOLS.md"
	raw, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}
	updated, err := Regenerate(string(raw))
	if err != nil {
		panic(err)
	}
	if err := os.WriteFile(path, []byte(updated), 0o644); err != nil {
		panic(err)
	}
	fmt.Println("docs/TOOLS.md capability table regenerated")
}

// Regenerate replaces the markdown table that starts at the
// "| Capability |" header with one generated from the registry.
func Regenerate(doc string) (string, error) {
	lines := strings.Split(doc, "\n")
	start := -1
	for i, l := range lines {
		if strings.HasPrefix(l, "| Capability |") {
			start = i
			break
		}
	}
	if start == -1 {
		return "", fmt.Errorf("TOOLS.md: capability table header not found")
	}
	end := start
	for end < len(lines) && strings.HasPrefix(lines[end], "|") {
		end++
	}
	var table []string
	table = append(table, "| Capability | HTTP | MCP tool | TS client |")
	table = append(table, "|---|---|---|---|")
	for _, d := range toolreg.Decls {
		cap := d.Capability
		if d.Note != "" {
			cap += " — " + d.Note
		}
		http := "—"
		if d.Method != "" {
			http = d.Method + " " + d.Path
		}
		mcp := d.MCP
		if mcp == "" {
			mcp = "—"
		}
		ts := d.TS
		if ts == "" {
			ts = "—"
		}
		table = append(table, fmt.Sprintf("| %s | %s | %s | %s |", cap, http, mcp, ts))
	}
	out := append(append([]string{}, lines[:start]...), table...)
	out = append(out, lines[end:]...)
	return strings.Join(out, "\n"), nil
}
