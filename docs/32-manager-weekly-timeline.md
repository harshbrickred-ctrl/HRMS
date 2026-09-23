# PeopleOS — Manager Weekly Development Timeline

**Audience:** Manager / Leadership (shareable status plan)  
**Product:** PeopleOS (internal HRMS)  
**Team:** 4 engineers (Lead/Architect, Backend, Frontend, Full-stack/QA)  
**Duration:** 12 weeks  
**Payroll:** Remains on **greytHR** (not built in MVP)  

**Date assumption:** Week 1 starts **Monday, 21 September 2026**.  
If kickoff moves, shift every start/end date by the same number of days. Weeks are **Monday–Friday**.

**Source of truth (detail):** [24-project-plan-12-weeks.md](24-project-plan-12-weeks.md) · [25-sprint-plan.md](25-sprint-plan.md) · [31-management-overview.md](31-management-overview.md)

---

## Evidence labels

| Label | Meaning |
|-------|---------|
| **Fact** | Locked plan structure (12 weeks, 4 engineers, P0 scope) |
| **Assumption** | Kickoff date of 21 Sep 2026 — confirm with sponsor |
| **Estimate** | Capacity and delivery risk judgments |

---

## 1. At a glance

| Phase | Weeks | Dates | What management should expect |
|-------|-------|-------|-------------------------------|
| Plan & design | 1–2 | 21 Sep – 02 Oct 2026 | Scope frozen; designs ready to build |
| Foundation | 3–4 | 05 Oct – 16 Oct 2026 | Login, security, project running |
| Core product | 5–8 | 19 Oct – 13 Nov 2026 | Employees, leave, approvals, attendance |
| User portals | 9–10 | 16 Nov – 27 Nov 2026 | Employee + Manager apps, documents, reports |
| Validate | 11 | 30 Nov – 04 Dec 2026 | HR testing + data migration rehearsal |
| Go-live | 12 | 07 Dec – 11 Dec 2026 | Pilot with a small user group |

---

## 2. Weekly plan (detailed)

| Week | Feature | Start date | End date | Description of feature | Checkpoint for manager |
|------|---------|------------|----------|------------------------|------------------------|
| 1 | Scope freeze & discovery | 21 Sep 2026 | 25 Sep 2026 | Confirm business problems with HR; lock Must-Have (P0) vs Later (P1/P2); list greytHR data exports needed | Signed P0 feature list; greytHR export checklist started |
| 2 | UX + architecture ready | 28 Sep 2026 | 02 Oct 2026 | Finalize screens for leave/approvals/employee profile; approve tech decisions; draft database design; map greytHR fields | “Ready to build” sign-off; Sprint 1 backlog ready |
| 3 | Login & platform setup | 05 Oct 2026 | 09 Oct 2026 | User login, project skeleton, Docker test environment, CI build pipeline | Demo: app runs in shared test environment; login works |
| 4 | Roles, permissions & audit | 12 Oct 2026 | 16 Oct 2026 | Employee / Manager / HR / Admin access control; audit log for sensitive actions | Demo: same user cannot access HR-only screens; audit entry visible |
| 5 | Core HR (employee & org) | 19 Oct 2026 | 23 Oct 2026 | Departments, designations, locations, employee profiles, manager hierarchy, search | Demo: HR creates/searches employees; org structure visible |
| 6 | Leave management | 26 Oct 2026 | 30 Oct 2026 | Leave types/policies, balances, apply leave, holidays | Demo: employee applies leave; balance shown correctly |
| 7 | Leave approvals (workflow) | 02 Nov 2026 | 06 Nov 2026 | Leave approval flow; manager approvals inbox; approve/reject with comments | Demo: manager approves/rejects leave; employee gets status update |
| 8 | Attendance | 09 Nov 2026 | 13 Nov 2026 | Daily attendance mark, CSV import hook, attendance correction requests | Demo: mark attendance + submit correction for approval |
| 9 | Employee & Manager portals | 16 Nov 2026 | 20 Nov 2026 | ESS home (leave/attendance status); manager team views; start document upload | Demo: usable Employee + Manager portals for daily work |
| 10 | Documents, notifications & reports | 23 Nov 2026 | 27 Nov 2026 | Secure documents; email + in-app alerts; headcount / leave / attendance / attrition reports | Feature freeze for new work; full P0 walkthrough demo |
| 11 | UAT, security & data dry-run | 30 Nov 2026 | 04 Dec 2026 | HR user acceptance testing; security checks; greytHR data import rehearsal + fix issues | **Go / No-Go** decision for pilot |
| 12 | Pilot go-live & training | 07 Dec 2026 | 11 Dec 2026 | Launch for a small pilot group; training; support/runbooks; baseline adoption metrics | Pilot live; training done; Week-12 status report to manager |

---

## 3. Sprint view (same plan)

| Sprint | Weeks | Dates | One-line goal |
|--------|-------|-------|---------------|
| Sprint 0 | 1–2 | 21 Sep – 02 Oct 2026 | Plan, design, freeze scope |
| Sprint 1 | 3–4 | 05 Oct – 16 Oct 2026 | Secure foundation |
| Sprint 2 | 5–6 | 19 Oct – 30 Oct 2026 | Core HR + Leave |
| Sprint 3 | 7–8 | 02 Nov – 13 Nov 2026 | Approvals + Attendance |
| Sprint 4 | 9–10 | 16 Nov – 27 Nov 2026 | Portals + documents + reports |
| Sprint 5 | 11 | 30 Nov – 04 Dec 2026 | UAT + migration rehearsal |
| Sprint 6 | 12 | 07 Dec – 11 Dec 2026 | Pilot go-live |

---

## 4. Simple risks to flag

| Risk | Mitigation |
|------|------------|
| Scope creep (“just add payroll”) | Keep P0 freeze; greytHR stays payroll SoR |
| greytHR data quality | Discovery + mapping in Weeks 1–2; dry-run in Week 11 |
| HR availability for decisions/UAT | Book HR time in Weeks 1–2, 5–7, and 11 |

---

## 5. Week 12 success picture

- Pilot users can: log in, manage leave, mark/correct attendance, use approvals inbox, view documents/reports  
- greytHR remains **payroll** system of record  
- Company-wide rollout and Azure investment only after pilot success  

---

*Document control: Manager-facing summary of the PeopleOS 12-week plan. Update dates here if kickoff changes; keep feature order aligned with docs 24/25.*
