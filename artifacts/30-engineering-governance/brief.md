---
manual: false
generated: 2026-09-16
---

# 30 — Engineering Governance

**Audience:** Delivery / Ops / QA  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Stack: NestJS + React + PostgreSQL modular monolith

## Key takeaways

- main: Always releasable; protected
- develop (optional): Integration if team prefers; else trunk-based on main with short PRs
- feature/<ticket-short-name: Feature work
- fix/<ticket-short-name: Bugfix
- chore/<topic: Tooling, deps
- hotfix/<ticket-short-name: Prod emergency from main
- PR size: Prefer vertical slices; split large features
- Reviewers: ≥1 approval; Lead reviews architecture-sensitive changes

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/30-engineering-governance.md`](../../docs/30-engineering-governance.md)

## Related artifacts

_None listed._
