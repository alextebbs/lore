# ADR 0008: Magic-link auth + per-user API tokens for MCP

Status: accepted (2026-07-27)

## Context

Options considered: OAuth providers via a Go library, managed auth
(Clerk/WorkOS), and passwordless email links. External MCP clients need
long-lived credentials regardless.

## Decision

Email magic links for sign-in — no passwords, no OAuth app registrations,
no auth vendor. Sessions stored in Postgres. Separately, users mint
long-lived API tokens for external MCP clients (Claude Code/Desktop);
tokens are revocable and scoped to the user.

## Consequences

- Requires a transactional email service (the one external service
  dependency for auth).
- No vendor fees or lock-in; consistent with the BYOK/no-vendor stance
  (ADR 0007).
- Login UX is slower than OAuth buttons; acceptable for v1.
- MCP tokens are a security surface: hashing at rest, revocation UI,
  last-used tracking.
