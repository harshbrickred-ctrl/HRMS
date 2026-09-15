---
manual: false
generated: 2026-09-13
---

# 15 — Multi-Tenant SaaS Readiness

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Shared database, shared schema, mandatory tenantid on all tenant-scoped tables, enforced in repository layer + automated tests that fail if filter missing.

## Key takeaways

- Shared DB / Shared schema: Weakest isolation; strong app filters required — Lowest — Highest density — Easiest — Complex per-tenant restore — Needs controls evidence — MVP + early SaaS
- Shared DB / Separate schema: Better isolation — Mid — Mid — Migrations painful — Easier schema dump — Better — Optional later
- DB per tenant: Strong — Highest — Limited by ops — Hard — Clean — Strongest — Enterprise tier later
- Hybrid: Flexible — Mid–high — Flexible — Complex — Mixed — Flexible — After product-market fit
- Tenant: Isolation root — Yes (one row)
- Organization: Legal entity / brand under tenant — Yes (simple)
- User: Login identity — Yes
- Role / Permission: Authz — Yes

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/15-multi-tenant-strategy.md`](../../docs/15-multi-tenant-strategy.md)

## Related artifacts

_None listed._
