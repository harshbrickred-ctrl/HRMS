---
manual: false
generated: 2026-09-13
---

# ADR-006 - Multi-Tenancy

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Internal MVP serves one company, but leadership wants a path to commercialize as SaaS. Rewriting schemas later to add tenancy is expensive and leak-prone.

## Key takeaways

- Lowest ops burden for Stage A/B (Fact preference).
- Prevents painful retrofit (Estimate: weeks of risk).
- Dual-tenant CI tests can prove isolation before SaaS.
- Locked decision (Fact).

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../../docs/26-adrs/ADR-006-multi-tenancy.md`](../../../docs/26-adrs/ADR-006-multi-tenancy.md)

## Related artifacts

_None listed._
