---
manual: false
generated: 2026-09-13
---

# 18 — Zero / Minimal-Cost Development Architecture (Stage A)

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Objective: Develop and validate PeopleOS with ₹0 paid cloud wherever reasonably achievable.

## Key takeaways

- Frontend: React + Vite + TypeScript — OSS — None material — High — Static Web Apps / Blob+CDN / Container — Low
- UI kit: Prefer lightweight (e.g. MUI or shadcn) — OSS — Design system effort — High — Same — Low
- Backend: NestJS + TypeScript — OSS — Monolith discipline required — High — Container Apps — Low
- ORM: Prisma — OSS — Some complex SQL harder — High — Same — Low
- DB: PostgreSQL 16 in Docker — OSS — Ops on engineers — High with managed service — Azure Database for PostgreSQL — Low–Mid
- Auth: Local argon2 passwords + JWT — OSS — No org SSO yet — Mid until Entra — Entra ID OIDC — Mid
- Files: Local disk or MinIO — OSS — Backup discipline — Mid — Blob Storage — Mid
- Email: Mailpit (dev) / company SMTP — OSS / Existing — Mailpit not prod — Low/High — ACS / SMTP relay — Low

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/18-zero-cost-architecture.md`](../../docs/18-zero-cost-architecture.md)

## Related artifacts

_None listed._
