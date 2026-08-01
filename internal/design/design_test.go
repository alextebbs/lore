// Package design enforces the frontend design language the same way
// toolreg enforces the tool surface: a grep test that fails when
// off-system styling lands. The system is: one 14px type size set on
// body (no size utilities, no font-size declarations), one radius
// (rounded), neutral surfaces, pure white primary text, and color only
// where sanctioned below.
package design

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

var forbidden = []*regexp.Regexp{
	regexp.MustCompile(`rounded-(full|lg|xl|2xl|3xl)`),
	regexp.MustCompile(`text-(xs|sm|base|lg|xl|2xl|3xl|\[[0-9]+px\])\b`),
	regexp.MustCompile(`text-neutral-(100|200)\b`),
	regexp.MustCompile(`!important`),
}

// Color families are permitted only where listed; red is the danger
// color and allowed everywhere.
var colorSanction = map[string][]string{
	"sky-":     {"editor.tsx"},                      // mention chips
	"emerald-": {"entry-page.tsx"}, // revision diff additions
	"violet-":  {},
	"amber-":   {"entry-page.tsx", "relations.tsx"}, // warnings
}

func TestDesignLanguage(t *testing.T) {
	files, err := filepath.Glob("../../web/src/*.tsx")
	if err != nil || len(files) == 0 {
		t.Fatalf("globbing web/src: %v (%d files)", err, len(files))
	}
	cssFiles, _ := filepath.Glob("../../web/src/*.css")

	for _, f := range append(files, cssFiles...) {
		raw, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		src := string(raw)
		base := filepath.Base(f)
		for _, re := range forbidden {
			// index.css defines the system itself — only the !important
			// check applies there.
			if base == "index.css" && re.String() != `!important` {
				continue
			}
			if m := re.FindString(src); m != "" {
				t.Errorf("%s: off-system token %q — use the control system (btn/chip/input/panel, one size, one radius)", base, m)
			}
		}
		for family, allowed := range colorSanction {
			if !strings.Contains(src, family) {
				continue
			}
			ok := false
			for _, a := range allowed {
				if base == a {
					ok = true
				}
			}
			if !ok {
				t.Errorf("%s: color family %q is not sanctioned here (allowed in: %v)", base, family, allowed)
			}
		}
	}

	// Module-scoped mutable state lives only in app-state.ts.
	for _, f := range files {
		raw, _ := os.ReadFile(f)
		for _, line := range strings.Split(string(raw), "\n") {
			if strings.HasPrefix(line, "let ") {
				t.Errorf("%s: module-level mutable state %q belongs in app-state.ts",
					filepath.Base(f), strings.TrimSpace(line))
			}
		}
	}
}
