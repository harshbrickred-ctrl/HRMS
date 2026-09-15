---
manual: false
generated: 2026-09-13
---

# 23 — Risk Register

**Audience:** Delivery / Ops / QA  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Scoring: Probability (1–5) × Impact (1–5) = Score. Rank by score.

## Key takeaways

- R01: Scope creep / feature overload — 5 — 5 — 25 — P0 freeze; weekly demo trade-offs — Descope P1 entirely — Lead + CEO sponsor
- R02: 12-week deadline slip — 4 — 5 — 20 — Critical path tracking; no payroll — Pilot with subset modules — Lead
- R03: Ambiguous HR workflows — 4 — 4 — 16 — Week 1–2 workshops; written rules — Default opinionated flows — HR Head + Lead
- R04: Temptation to build payroll — 4 — 5 — 20 — CEO condition; ADR — Keep greytHR payroll — CEO / Product
- R05: greytHR data quality / export gaps — 4 — 4 — 16 — Early export discovery; dry-run — Manual cleanse; phased import — HR + Backend
- R06: Dual-system confusion — 3 — 4 — 12 — Clear SoR matrix (PeopleOS vs greytHR) — Comms + training — HR Head
- R07: Security vulnerability / PII leak — 3 — 5 — 15 — Security design; tests; review gate — Delay go-live — Lead + Security
- R08: Free-tier CI limits — 3 — 3 — 9 — Self-hosted runner; fewer jobs — Pause noncritical CI — Full-stack/QA

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/23-risk-register.md`](../../docs/23-risk-register.md)

## Related artifacts

_None listed._
