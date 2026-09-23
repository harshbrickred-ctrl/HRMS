---
manual: false
generated: 2026-09-16
---

# ADR-007 - API Strategy: Versioned REST

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Deciders: Solution Architect, Backend, Frontend

## Key takeaways

- NestJS + React ecosystem fits REST/OpenAPI well (Fact).
- Versioning allows additive evolution without stealth breaks.
- GraphQL adds caching/authz complexity for little MVP gain (Estimate).
- gRPC poor fit for browser SPA without gateway.

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../../docs/26-adrs/ADR-007-api-strategy.md`](../../../docs/26-adrs/ADR-007-api-strategy.md)

## Related artifacts

_None listed._
