---
manual: true
generated: 2026-09-14
---

# MVP PRD Brief — What Ships in 12 Weeks

**Audience:** Product / HR / Engineering Lead  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

PeopleOS Week-12 release is a **brutal P0**: Identity/RBAC, Core HR, Leave, Attendance (mark/import + corrections), Workflow v1 (sequential + reminders), Documents, ESS + Manager inbox, Notifications, Audit, operational reports, greytHR CSV migration, Docker/OpenAPI/CI. **P1 is stretch only**; payroll engine is forbidden.

## Key takeaways

- **Capacity (Estimate):** ~240 person-days gross → ~145–155 effective → ~15% contingency.
- **P0 committed:** SoR for people + leave + attendance coordination + approvals + documents — not full HCM suite.
- **Workflow:** sequential approvers + inbox + reminders = P0; **escalation SLA = P1**.
- **Attendance:** web mark + CSV import + correction workflow — not biometric cloud.
- **Payroll:** export/coordination boundary only; greytHR remains payroll SoR.
- **P1 stretch:** light ATS, onboarding checklists, IT assets, simple HR tickets.
- **P2 deferred:** PMS, LMS, expenses, advanced BI, native mobile, WhatsApp, billing, SCIM, AI.
- **Success:** pilot cohort live, migration dry-run pass, P0 AC met — no P2 in release.

## Evidence labels

Scope is **Fact** (locked). Effort numbers are **Estimate**. Adoption outcomes are **Metric-to-measure**.

## Out of scope / non-claims

This brief is not the FR catalog. Traceability lives in SRS / stories.

## Deep dive

[`../../docs/05-product-requirements-mvp.md`](../../docs/05-product-requirements-mvp.md)

## Related artifacts

- [03-product-vision](../03-product-vision/brief.md)
- [06-srs-functional](../06-srs-functional/brief.md)
- [24-project-plan-12-weeks](../24-project-plan-12-weeks/brief.md)
