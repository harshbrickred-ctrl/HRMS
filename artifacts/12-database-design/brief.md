---
manual: false
generated: 2026-09-13
---

# 12 — Database Design

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Style: Shared schema, single-tenant runtime, tenantid on all business tables

## Key takeaways

- Tenancy-ready: Every business row carries tenantid UUID NOT NULL. MVP runs one tenant; SaaS later uses shared-schema row isolation.
- Surrogate keys: Primary keys are UUID (genrandomuuid()). Natural keys enforced via unique constraints.
- Soft delete: Operational entities use deletedat TIMESTAMPTZ NULL. Hard delete only for purge jobs / GDPR-style erasure with audit trail.
- Effective dating: Org structure and employment use effectivefrom / effectiveto (inclusive-exclusive or closed-open; document per table).
- History: Mutable HR facts that affect compliance (employment, designation, compensation stubs) write history rows; do not overwrite silently.
- Audit: Application writes auditevent; DB triggers optional for critical tables later.
- Retention: Retention policies defined per domain; physical purge is a controlled job, never ad-hoc DELETE from app UI.
- No payroll engine: payrollinput is an export stub only. No statutory salary computation tables in MVP.

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/12-database-design.md`](../../docs/12-database-design.md)

## Related artifacts

_None listed._
