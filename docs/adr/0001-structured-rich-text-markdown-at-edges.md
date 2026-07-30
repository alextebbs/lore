# ADR 0001: Structured rich-text storage, Markdown at the edges

Status: accepted (2026-07-27)

## Context

We need span-level draft/canon delineation *within* paragraphs. Pure
Markdown as source of truth would require custom marker syntax that every
editor, differ, and AI edit must preserve perfectly; sidecar character
ranges drift on every edit.

## Decision

Store rich text as a structured document (ProseMirror/TipTap-style JSON)
where draft/canon is a span mark, like bold. The MCP surface and agent
speak Markdown with lightweight `{~draft}...{/~}` markers, translated by
the server at the tool-layer boundary (`internal/richtext`), exactly once.
Export renders clean Markdown, markers stripped.

## Consequences

- Reliable span tracking and a real WYSIWYG story (TipTap with a custom
  mark); agents still read/write natural Markdown.
- The marker ⇄ document conversion is load-bearing and needs exhaustive
  round-trip tests.
- Raw DB content is not human-readable Markdown; export is the readable
  form.
