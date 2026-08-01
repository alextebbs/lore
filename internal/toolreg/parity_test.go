package toolreg

import (
	"os"
	"strings"
	"testing"
)

// The TS client is the one surface Go can't assert at compile time —
// this test greps web/src/api.ts for every declared client method so a
// missing adapter fails CI instead of drifting.
func TestTSClientParity(t *testing.T) {
	raw, err := os.ReadFile("../../web/src/api.ts")
	if err != nil {
		t.Fatalf("reading api.ts: %v", err)
	}
	src := string(raw)
	for _, d := range Decls {
		if d.TS == "" {
			continue
		}
		if !strings.Contains(src, d.TS+":") && !strings.Contains(src, d.TS+"(") {
			t.Errorf("web/src/api.ts lacks client method %q (capability %s)", d.TS, d.Capability)
		}
	}
}

// TOOLS.md's capability table must be regenerated (make tools-docs)
// whenever the registry changes.
func TestToolsDocCurrent(t *testing.T) {
	raw, err := os.ReadFile("../../docs/TOOLS.md")
	if err != nil {
		t.Fatalf("reading TOOLS.md: %v", err)
	}
	src := string(raw)
	for _, d := range Decls {
		if d.MCP != "" && !strings.Contains(src, d.MCP) {
			t.Errorf("docs/TOOLS.md missing MCP tool %q — run make tools-docs", d.MCP)
		}
		if d.Method != "" && !strings.Contains(src, d.Method+" "+d.Path) {
			t.Errorf("docs/TOOLS.md missing route %q — run make tools-docs", d.Method+" "+d.Path)
		}
	}
}
