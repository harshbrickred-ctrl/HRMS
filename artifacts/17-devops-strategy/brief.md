---
manual: false
generated: 2026-09-13
---

# 17 — DevOps & CI/CD Strategy

**Audience:** Delivery / Ops / QA  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Stage A: Local Docker Compose + OSS + GitHub Actions free tier

## Key takeaways

- Build→tests on PR: GitHub Actions — Assumption (tool choice locked in ADR)
- Artifact: GHCR free tier or local registry / tar — Assumption
- Dev/QA/UAT/Pilot hosts: Compose on shared internal VMs/PCs — Assumption
- Azure deploy: Deferred until investment gate — Fact of plan
- main: Always deployable; release source — Yes
- feature/: Work items — No
- hotfix/: Pilot Sev-1 — Fast-follow review
- release/: Optional if parallel hardening needed — Yes if used

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/17-devops-strategy.md`](../../docs/17-devops-strategy.md)

## Related artifacts

_None listed._
