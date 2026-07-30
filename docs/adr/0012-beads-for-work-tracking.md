# ADR 0012: Beads for work tracking; markdown for knowledge

Status: accepted (2026-07-28)

## Context

The app is built primarily by AI sessions whose context resets. Work
state must persist in the repo. Markdown ROADMAP/plans files were
considered but require agents to parse and re-serialize free text, and
encode dependencies poorly.

## Decision

Task tracking lives in beads (`bd`): epics are milestones, dependencies
encode build order, `bd ready` is the source of "what's next". Knowledge
lives in markdown: SPEC.md (canon), docs/ (architecture, domain,
conventions, tools contract), docs/adr/ (decisions). The plan-approval
workflow: agents design epics (design field + child tasks) and the user
approves before implementation — mirroring the app's own draft/canon
tenet.

## Consequences

- Cross-session continuity via the issue graph; no stale checklist files.
- Contributors need the `bd` CLI installed.
- Knowledge docs remain human-reviewable prose; work items don't clutter
  them.
