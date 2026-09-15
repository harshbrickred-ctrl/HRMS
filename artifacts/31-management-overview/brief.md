---
manual: true
generated: 2026-09-14
---

# Management Overview Brief — PeopleOS

**Audience:** CEO / Leadership / Management  
**Artifact type:** Meeting skim (1–2 minutes) → full narrative for depth

## Thesis

PeopleOS is an **owned internal HRMS** for our ~500-person India IT consultancy: Core HR, leave, attendance, documents, approvals, ESS/Manager — while **greytHR stays payroll SoR**. Build with 4 engineers in 12 weeks on NestJS + React + PostgreSQL; Azure later. Recommendation: **APPROVE WITH CONDITIONS**.

## Key takeaways

- **Product:** Own people ops platform; not a greytHR payroll clone.
- **Stack:** Modular monolith — NestJS, React, PostgreSQL, Docker Compose Stage A (₹0 target), Azure Stage B after gates.
- **P0 features:** Identity/RBAC, Core HR, Leave, Attendance, Workflow v1, Documents, ESS/Manager, Notifications, Audit, reports, greytHR CSV migration.
- **Out:** Payroll engine, PMS/LMS/expenses, native mobile, AI agents, AKS, billing.
- **Team:** Lead/Architect, Backend, Frontend, Full-stack/QA (+ HR/Finance/IT stakeholders).
- **Roadmap:** Phase 1 MVP (0–3 mo) → Phase 2 hardening/Azure → Phase 3–5 SaaS optionality only after proof.

## Evidence labels

Fact / Assumption / Estimate / Metric-to-measure — **no invented ROI** in the full document.

## Out of scope / non-claims

This card is not the approval instrument. Conditions and metrics live in the deep dive and executive proposal.

## Deep dive

Full management narrative: [`../../docs/31-management-overview.md`](../../docs/31-management-overview.md)

## Related artifacts

- [01-executive-proposal](../01-executive-proposal/brief.md)
- [05-product-requirements-mvp](../05-product-requirements-mvp/brief.md)
- [appendices/part-48-final-recommendation](../appendices/part-48-final-recommendation/brief.md)
