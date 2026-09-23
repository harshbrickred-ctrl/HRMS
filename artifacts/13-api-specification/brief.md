---
manual: false
generated: 2026-09-16
---

# 13 — API Specification

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Stack: NestJS controllers + DTOs + class-validator

## Key takeaways

- URI versioning: All routes under /api/v1/...
- Breaking change: New major (/api/v2); no silent breaks in v1
- Non-breaking: Additive fields, new optional query params, new endpoints OK in v1
- Deprecation: Deprecation + Sunset headers when retiring
- GET: Read; safe; idempotent
- POST: Create or non-idempotent action
- PUT: Full replace (rare)
- PATCH: Partial update

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/13-api-specification.md`](../../docs/13-api-specification.md)

## Related artifacts

_None listed._
