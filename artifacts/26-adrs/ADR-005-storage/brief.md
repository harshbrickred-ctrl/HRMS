---
manual: false
generated: 2026-09-13
---

# ADR-005 - Storage: Local/MinIO ? Azure Blob

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

HR documents (IDs, letters, optional payslip PDFs) must not live in PostgreSQL BYTEA at scale. Stage A needs zero/minimal cost; Stage B needs durable managed object storage.

## Key takeaways

- Keeps Stage A cost near zero (Fact locked stack).
- Blob is the justified Azure equivalent (Fact).
- Avoids DB bloat and backup inflation.
- Path prefix tenantid/ supports multi-tenant isolation.

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../../docs/26-adrs/ADR-005-storage.md`](../../../docs/26-adrs/ADR-005-storage.md)

## Related artifacts

_None listed._
