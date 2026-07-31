// Package agent is the in-app chat harness: a manual Anthropic tool-use
// loop over the same tool layer every other surface consumes (ADR 0005).
// The harness is UI-only orchestration (SPEC tenet 2 exception) — every
// capability it exercises is a public tool. Writes carry AuthorAI and
// land as draft (tenet 4); mark_canon/restore are deliberately absent
// from its tool set (promotion is human-gated in the UI).
package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

	"github.com/alextebbs/lore/internal/tools"
)

const model = anthropic.ModelClaudeOpus4_8

const systemPrompt = `You are the worldbuilding assistant inside Lore, a TTRPG
worldbuilding tool. You help the user author and organize their world:
characters, places, events, items, factions, and the relations between them.

Rules:
- Everything you write lands as DRAFT until the human promotes it to canon.
  Draft spans in markdown appear as {~draft}...{/~}; your text is auto-marked.
- Canon content is world truth — never contradict it. You cannot delete canon.
- Prefer minimal edits: update_entry replaces fields/body you send, so send
  only what you're changing.
- Use find_relevant and get_entry to load context before authoring. Use
  create_edge to relate entries; relation fields and their allowed targets
  come from get_world.
- When creating several related entries, create them all, then wire edges.
- Be concrete and evocative but concise. Match the world's established tone.
- The CONTEXT section below contains the user's context tray: pinned entries,
  the page they're viewing, and auto-retrieved entries. Treat it as the
  working set; fetch more with tools when needed.`

// Event is one step of the loop, streamed to the UI as it happens.
type Event struct {
	Type    string          `json:"type"` // context | text | tool_call | tool_result | error | done
	Text    string          `json:"text,omitempty"`
	Name    string          `json:"name,omitempty"`
	Input   json.RawMessage `json:"input,omitempty"`
	Result  string          `json:"result,omitempty"`
	IsError bool            `json:"is_error,omitempty"`
	Tray    *tools.Tray     `json:"tray,omitempty"`
}

type Agent struct {
	tools  *tools.Tools
	client anthropic.Client
	hasKey bool
}

func New(t *tools.Tools, apiKey string) *Agent {
	return &Agent{
		tools:  t,
		client: anthropic.NewClient(option.WithAPIKey(apiKey)),
		hasKey: apiKey != "",
	}
}

func (a *Agent) Ready() bool { return a.hasKey }

// Turn is a stored conversation message: role + content blocks in
// Anthropic wire shape, persisted as JSON.
type Turn struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`
}

// Run executes one conversation turn: assemble context, then loop
// model → tools until the model stops. Emits events; returns the new
// turns (assistant/tool transcript) to persist.
func (a *Agent) Run(ctx context.Context, worldID, currentEntryID, userMessage string, history []Turn, evicted []string, emit func(Event)) ([]Turn, error) {
	if !a.hasKey {
		return nil, fmt.Errorf("ANTHROPIC_API_KEY is not configured — set it in .env and restart")
	}

	tray, err := a.tools.GetContextTray(ctx, worldID, currentEntryID, userMessage, evicted)
	if err != nil {
		return nil, err
	}
	emit(Event{Type: "context", Tray: &tray})

	world, err := a.tools.GetWorld(ctx, worldID)
	if err != nil {
		return nil, err
	}
	types, err := a.tools.ListTypes(ctx, worldID)
	if err != nil {
		return nil, err
	}
	typeLines := make([]string, 0, len(types))
	for _, et := range types {
		fields := make([]string, 0, len(et.Fields))
		for _, f := range et.Fields {
			d := f.Name + ":" + f.Kind
			if f.Relation != nil {
				d += fmt.Sprintf("(→%s)", strings.Join(f.Relation.Targets, "|"))
			}
			fields = append(fields, d)
		}
		typeLines = append(typeLines, fmt.Sprintf("- %s [id: %s] fields: %s", et.Name, et.ID, strings.Join(fields, ", ")))
	}

	var contextSB strings.Builder
	fmt.Fprintf(&contextSB, "WORLD: %s [id: %s]\n\nENTRY TYPES:\n%s\n\nCONTEXT TRAY:\n",
		world.Name, world.ID, strings.Join(typeLines, "\n"))
	for _, item := range tray.Items {
		fmt.Fprintf(&contextSB, "\n--- [%s, %s] ---\n%s\n", item.Source, item.Level, item.Text)
	}
	if len(tray.Items) == 0 {
		contextSB.WriteString("(empty — use find_relevant and list_entries to explore)\n")
	}

	// Build message history: prior turns + context-wrapped user message.
	messages := make([]anthropic.MessageParam, 0, len(history)+1)
	for _, turn := range history {
		var blocks []anthropic.ContentBlockParamUnion
		if err := json.Unmarshal(turn.Content, &blocks); err != nil {
			continue
		}
		role := anthropic.MessageParamRoleUser
		if turn.Role == "assistant" {
			role = anthropic.MessageParamRoleAssistant
		}
		messages = append(messages, anthropic.MessageParam{Role: role, Content: blocks})
	}
	messages = append(messages, anthropic.NewUserMessage(
		anthropic.NewTextBlock("<context>\n"+contextSB.String()+"\n</context>\n\n"+userMessage),
	))

	adaptive := anthropic.ThinkingConfigAdaptiveParam{}
	var newTurns []Turn

	for iter := 0; iter < 16; iter++ {
		resp, err := a.client.Messages.New(ctx, anthropic.MessageNewParams{
			Model:     model,
			MaxTokens: 8192,
			System: []anthropic.TextBlockParam{{
				Text:         systemPrompt,
				CacheControl: anthropic.NewCacheControlEphemeralParam(),
			}},
			Thinking: anthropic.ThinkingConfigParamUnion{OfAdaptive: &adaptive},
			Messages: messages,
			Tools:    a.toolDefs(),
		})
		if err != nil {
			return newTurns, fmt.Errorf("anthropic api: %w", err)
		}

		messages = append(messages, resp.ToParam())
		if turn, err := turnFromResponse(resp); err == nil {
			newTurns = append(newTurns, turn)
		}

		var results []anthropic.ContentBlockParamUnion
		for _, block := range resp.Content {
			switch v := block.AsAny().(type) {
			case anthropic.TextBlock:
				emit(Event{Type: "text", Text: v.Text})
			case anthropic.ToolUseBlock:
				input := json.RawMessage(v.JSON.Input.Raw())
				emit(Event{Type: "tool_call", Name: v.Name, Input: input})
				result, isErr := a.execute(ctx, worldID, v.Name, input)
				emit(Event{Type: "tool_result", Name: v.Name, Result: truncate(result, 2000), IsError: isErr})
				results = append(results, anthropic.NewToolResultBlock(v.ID, result, isErr))
			}
		}

		if resp.StopReason != anthropic.StopReasonToolUse {
			emit(Event{Type: "done"})
			return newTurns, nil
		}
		messages = append(messages, anthropic.NewUserMessage(results...))
		if turn, err := marshalTurn("user", results); err == nil {
			newTurns = append(newTurns, turn)
		}
	}
	emit(Event{Type: "error", Text: "agent reached iteration limit"})
	return newTurns, nil
}

func turnFromResponse(resp *anthropic.Message) (Turn, error) {
	blocks := resp.ToParam().Content
	return marshalTurn("assistant", blocks)
}

func marshalTurn(role string, blocks []anthropic.ContentBlockParamUnion) (Turn, error) {
	raw, err := json.Marshal(blocks)
	if err != nil {
		return Turn{}, err
	}
	return Turn{Role: role, Content: raw}, nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
