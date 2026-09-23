---
manual: false
generated: 2026-09-16
---

# 20 — Migration Strategy (Stage A → Azure Stage B)

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Discipline: No invented prices; label Fact / Assumption / Estimate.

## Key takeaways

- Preferred compute target: Container Apps: Fact
- Dual-run period may be days–weeks: Estimate
- Payroll remains external during migration: Fact
- Current: Docker Compose api service
- Azure: Azure Container Apps revision(s)
- Process: Build image in GHA → push ACR → deploy ACA YAML/Bicep; smoke /health; run migrations job
- Data concerns: Stateless; sticky sessions not required if JWT
- Config: DATABASEURL, storage, JWT keys, DEFAULTTENANTID, App Insights connection

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/20-migration-strategy.md`](../../docs/20-migration-strategy.md)

## Related artifacts

_None listed._
