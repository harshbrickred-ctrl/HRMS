---
manual: false
generated: 2026-09-16
---

# 11 — Domain Architecture

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Defines bounded contexts, MVP modules, deferred domains, aggregates, and domain events for PeopleOS. Aligns product language with NestJS module boundaries inside the modular monolith.

## Key takeaways

- India IT consultancy ~500 employees; greytHR incumbent: Fact (org context)
- Payroll statutory engine not built; integration boundary only: Fact (locked)
- ATS, Assets, full LMS, Benefits engines deferred: Assumption (MVP freeze)
- Module list below is the build contract for 12-week MVP: Estimate (capacity-fit)
- Tenant: Logical customer/org isolation key (tenantid); MVP = one runtime tenant
- Organization / OrgUnit: Internal hierarchy (BU, department, team)
- Employee: Person with employment relationship(s); not identical to User
- User: Login principal; usually 1:1 with Employee for ESS

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/11-domain-architecture.md`](../../docs/11-domain-architecture.md)

## Related artifacts

_None listed._
