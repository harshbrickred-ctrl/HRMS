---
manual: false
generated: 2026-09-16
---

# Architecture Decision Records (ADR-001 … ADR-012)

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Primary framing for Architecture Decision Records (ADR-001 … ADR-012): ADR-001: Architecture — Modular monolith

## Key takeaways

- ADR-001: Architecture — Modular monolith
- ADR-002: Database — PostgreSQL + Prisma
- ADR-003: Authentication — Local JWT; OIDC later
- ADR-004: Authorization — RBAC + resource policies
- ADR-005: Storage — Local/MinIO → Blob via interface
- ADR-006: Multi-tenancy — Shared schema + tenantid
- ADR-007: API — Versioned REST + OpenAPI
- ADR-008: Messaging — In-process + outbox → Service Bus

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../../docs/26-adrs/README.md`](../../../docs/26-adrs/README.md)

## Related artifacts

_None listed._
