---
manual: false
generated: 2026-09-16
---

# ADR-008 - Messaging: In-Process ? Service Bus Later

**Audience:** Product / HR / BA  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Leave approvals, emails, and reports need asynchronous work. Introducing Kafka/Rabbit/Service Bus on day one adds ops cost before product validation.

## Key takeaways

- Modular monolith does not need a broker for intra-app events (Fact style).
- Outbox survives process crash better than pure in-memory.
- Service Bus is the locked -later- Azure choice (Fact).
- Avoids premature paid messaging.

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../../docs/26-adrs/ADR-008-messaging.md`](../../../docs/26-adrs/ADR-008-messaging.md)

## Related artifacts

_None listed._
