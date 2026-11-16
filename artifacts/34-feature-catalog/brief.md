---
manual: false
generated: 2026-11-13
---

# PeopleOS — Feature Catalog

**Audience:** Product / HR / BA  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

As of: 13 Nov 2026 (running codebase under apps/)

## Key takeaways

- Live: Saved in Postgres; survives reload; API + UI wired
- Partial: Some of it is live; gaps listed
- UI only: Screen exists; data is mock/static or incomplete
- Planned: Intended later; not built
- Login / logout / refresh JWT: All — Email + password
- Forgot password (email OTP): All — Via Mailpit locally / SMTP on deploy
- Change password: All — Settings; revokes other sessions
- Roles & permissions (RBAC): Security / IT Admin — Assign/revoke roles on Users & Roles

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/34-feature-catalog.md`](../../docs/34-feature-catalog.md)

## Related artifacts

_None listed._
