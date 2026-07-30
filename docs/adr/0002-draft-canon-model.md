# ADR 0002: Draft/canon at three granularities; human input born canon; AI has full power over drafts

Status: accepted (2026-07-27)

## Context

Tenets 3–5 require draft/canon metadata everywhere, AI authoring in draft,
and human-gated promotion. Open questions were granularity, the status of
human-typed content, and how much freedom AI has over drafts.

## Decision

- Status is tracked at **entry, field, and span** granularity. An entry's
  overall status is *derived* ("canon with 3 draft fields"); "mark canon"
  on an entry bulk-canonizes its contents.
- **Human-typed content is born canon.** Draft means "AI-authored,
  awaiting human blessing."
- **AI has full power over drafts**: create, modify, and delete draft
  entries/edges without explicit instruction. Revision history (ADR
  0011) is the safety net. Canon requires explicit human orders, enforced
  in the tool layer via an explicit override flag — not by prompt.

## Consequences

- Fine-grained provenance is the product's core differentiator; it costs
  status plumbing at all three levels.
- Agent workflows like "consolidate these three draft characters" work
  without ceremony.
- An unwanted AI change to a draft is recovered via revisions, not
  prevented via approval gates.
