---
manual: false
generated: 2026-09-13
---

# ADR-001 - Architecture Style: Modular Monolith

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Deciders: Solution Architect, Engineering Lead

## Key takeaways

- Matches team size and timeline (Estimate).
- Single transaction model simplifies leave + workflow consistency.
- Avoids network failure modes, distributed tracing tax, and AKS/service mesh.
- Module boundaries + tenantid preserve SaaS evolution path.
- Locked organizational decision (Fact).

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../../docs/26-adrs/ADR-001-architecture.md`](../../../docs/26-adrs/ADR-001-architecture.md)

## Related artifacts

_None listed._
