---
manual: false
generated: 2026-09-16
---

# 16 — Testing Strategy

**Audience:** Delivery / Ops / QA  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Committed scope: P0 MVP · 12-week internal pilot

## Key takeaways

- Unit: 50–60% — Code author
- Integration / API: 25–30% — BE + FS/QA
- UI component: 5–10% — FE
- E2E: 10–15% — FS/QA
- Manual UAT / exploratory: Parallel, time-boxed — HR + FS/QA
- Domain pure logic: Leave balance ledger, overlap rules, attendance idempotency keys
- Guards / policies: Permission evaluation matrix samples
- Mappers / validators: DTO validation, CSV row parse

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/16-testing-strategy.md`](../../docs/16-testing-strategy.md)

## Related artifacts

_None listed._
