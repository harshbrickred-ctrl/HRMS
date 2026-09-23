---
manual: false
generated: 2026-09-16
---

# 04 — Business Requirements Document (BRD)

**Audience:** Product / HR / BA  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Scope: Business needs for replacing parts of greytHR (Core HR, leave, attendance, docs, ESS/manager, workflow, audit, reports). Payroll engine out of scope.

## Key takeaways

- Organization: ~500-employee India IT consultancy — Fact
- Geography: India-only for MVP — Fact
- Incumbent: greytHR — Fact
- Build window: 4 engineers × 12 weeks — Fact
- Stack: NestJS + React + PostgreSQL modular monolith — Fact
- Payroll: Keep / integrate greytHR payroll initially; no full engine — Fact
- Headcount and attrition visibility depends on HR extracts: Decision latency — Self-serve operational snapshots
- Unclear leave liability / attendance discipline signals: Weak governance narrative — Exception dashboards, not vanity BI

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/04-business-requirements.md`](../../docs/04-business-requirements.md)

## Related artifacts

_None listed._
