---
manual: false
generated: 2026-09-13
---

# ADR-004 - Authorization: RBAC + Resource Policies

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

HR systems fail when authorization is only -role = admin.- Managers must act on their team; employees on self; HR on broader scopes. Document and salary-adjacent files need stricter checks than generic CRUD.

## Key takeaways

- RBAC alone cannot express -manager of requester.-
- Full ReBAC is heavy for 12-week MVP (Estimate).
- Policies compose with tenantid isolation.
- Auditable permission codes support SaaS later.

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../../docs/26-adrs/ADR-004-authorization.md`](../../../docs/26-adrs/ADR-004-authorization.md)

## Related artifacts

_None listed._
