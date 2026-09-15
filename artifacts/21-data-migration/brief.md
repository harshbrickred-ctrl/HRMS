---
manual: false
generated: 2026-09-13
---

# 21 — Data Migration (greytHR → PeopleOS)

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Primary transfer mode for MVP: Excel / CSV exports (not deep API sync)

## Key takeaways

- Employees (master): Yes — Core
- Org units / departments: Yes — May simplify hierarchy
- Manager relationships: Yes — Critical for workflow
- Employment status / DOJ / DOL: Yes — As available
- Leave types & balances: Yes — Policy may be re-configured then balances loaded
- Leave request history: Partial — Assumption: open/pending + recent N months; full history optional
- Attendance: Yes for pilot window — e.g. last 3–12 months — Assumption confirm with HR
- Documents: Partial — Metadata + selective files; bulk binary may be phased

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/21-data-migration.md`](../../docs/21-data-migration.md)

## Related artifacts

_None listed._
