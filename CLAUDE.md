# Project Instructions for AI Agents

Lore is an AI-native TTRPG worldbuilding app. Read `SPEC.md` first — it is
the product spec and it is **canon**.

## Canon rule (applies to docs, not just app content)

The repo runs on the app's own tenets. `SPEC.md` and accepted ADRs in
`docs/adr/` are canon: do not modify them without explicit instruction from
the user. If your work conflicts with canon, stop and flag the conflict —
never silently resolve it. Everything you author starts as a proposal the
user promotes.

## Where knowledge lives

- `SPEC.md` — what we're building (canon, human-owned)
- `docs/ARCHITECTURE.md` — system shape: packages, request flow, data flow
- `docs/DOMAIN.md` — glossary; use these words in code and docs
- `docs/CONVENTIONS.md` — how code is written here
- `docs/TOOLS.md` — the tool-layer contract (= API spec = MCP surface)
- `docs/adr/` — why decisions were made; check before proposing changes
  that touch a settled decision

## Where work lives: beads

All task tracking is in beads (see managed block below) — no ROADMAP.md, no
plans/ directory, no markdown checklists. The issue graph is the roadmap:
epics are milestones, dependencies encode build order.

### Workflow

1. **Pick work** from `bd ready` (or what the user assigns).
2. **Plan before code.** For an epic: write the design into the epic's
   design field and create child tasks (`bd create --parent <epic>`) with
   dependencies between them. Then ask the user to review. Do not start
   implementing an epic whose design the user has not approved.
3. **Track honestly.** Mark in_progress when you start; close only when
   acceptance criteria are verified (tests run, behavior demonstrated),
   and record how it was verified in the notes.
4. **File discoveries immediately.** Found a bug, gap, or follow-up
   mid-task? `bd create` it with `--deps discovered-from:<current-id>` and
   keep going. Never hold work-to-be-done in your head or in comments.
5. **Docs ship with code.** A diff that changes behavior updates
   `docs/TOOLS.md` / `ARCHITECTURE.md` / `DOMAIN.md` in the same commit. A
   diff that makes a new architectural decision adds an ADR (proposed;
   the user accepts it).
6. **Commit per task**, referencing the bead id in the message.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

## Build & Test

Nothing is "done" because the code is written. Each task's acceptance
criteria say how to verify; run them. **Headless-first (SPEC tenet 2):**
a capability is done only when it works on every applicable surface —
JSON API (curl), MCP, and UI. Defaults once the scaffolds exist:

```bash
go test ./...          # backend
npm test               # frontend (in web/)
npm run build          # frontend build must stay green
```

For tool-layer work, exercise the tool through the MCP endpoint, not just
unit tests.

## Architecture Overview

See `docs/ARCHITECTURE.md`. One Go binary serves the JSON API, the MCP
endpoint, the agent loop, and the built SPA. Postgres (+ pgvector + FTS) is
the only datastore.

## Conventions & Patterns

See `docs/CONVENTIONS.md` and use the vocabulary in `docs/DOMAIN.md`.
