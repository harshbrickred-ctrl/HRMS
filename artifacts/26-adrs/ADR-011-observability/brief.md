---
manual: false
generated: 2026-09-16
---

# ADR-011 - Observability: OpenTelemetry / Structured Logs ? App Insights

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

HR workflows fail silently without correlation across API, DB, and email. Stage A cannot rely on paid APM; Stage B should use Azure-native monitoring without rewriting instrumentation.

## Key takeaways

- Portable instrumentation avoids rewrite (Fact OTel goal).
- App Insights aligns with Azure target (Fact locked).
- Self-hosted ELK is ops-heavy for 4 engineers (Estimate).
- Trials are not a strategy.

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../../docs/26-adrs/ADR-011-observability.md`](../../../docs/26-adrs/ADR-011-observability.md)

## Related artifacts

_None listed._
