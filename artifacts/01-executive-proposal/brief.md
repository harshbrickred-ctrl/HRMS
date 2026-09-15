---
manual: true
generated: 2026-09-14
---

# CEO Approval Brief — PeopleOS Executive Proposal

**Audience:** CEO / Leadership  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Approve a **12-week internal HRMS (PeopleOS)** for our ~500-person India IT consultancy: own Core HR, leave, attendance coordination, documents, and approvals — while **keeping greytHR as payroll system of record**. Recommendation: **APPROVE WITH CONDITIONS**.

## Key takeaways

- **Why build:** Platform ownership, workflow/UX/API control, and future SaaS optionality — not to beat greytHR at Indian statutory payroll.
- **Team / time:** 4 engineers × 12 weeks; Stage 1 infra target **₹0** (Docker/OSS/free-tier CI).
- **Stack:** NestJS + React + PostgreSQL modular monolith; `tenant_id` ready; Azure later.
- **P0 MVP:** Identity/RBAC, Core HR, Leave, Attendance (+CSV), Workflow v1, Documents, ESS/Manager, Notifications, Audit, ops reports, greytHR CSV migration.
- **Explicitly out:** Full payroll engine, PMS/LMS/expenses, native mobile, AI agents, AKS/microservices, commercial billing.
- **Success = metrics to measure** (adoption, leave cycle time, Excel reduction) — **no invented ROI** in this pack.
- **Azure spend gated** on UAT + pilot adoption; dual-run clarity: PeopleOS ≠ payroll until Phase 2 decision.

## Evidence labels

**Fact** (company context, greytHR incumbent, locked stack) · **Assumption** (process pain to validate in Week 1) · **Estimate** (capacity) · **Metric-to-measure** (post-go-live).

## Out of scope / non-claims

This brief is not the approval document. Conditions, investment categories, and risk detail live in the deep dive.

## Deep dive

Full document (source of truth): [`../../docs/01-executive-proposal.md`](../../docs/01-executive-proposal.md)

## Related artifacts

- [02-market-analysis](../02-market-analysis/brief.md)
- [23-risk-register](../23-risk-register/brief.md)
- [appendices/part-48-final-recommendation](../appendices/part-48-final-recommendation/brief.md)
