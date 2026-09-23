# Progress

**Product:** PeopleOS (internal HRMS)  
**Last updated:** 2026-09-23  

**Rule:** Move items from **To Do → Completed** only when implemented and demoable (not when merely documented).  
**Related:** [Decision.md](Decision.md) · [docs/05-product-requirements-mvp.md](docs/05-product-requirements-mvp.md) · [docs/32-manager-weekly-timeline.md](docs/32-manager-weekly-timeline.md)

---

## Completed

| ID | Item | Type | Completed on | Notes |
|----|------|------|--------------|-------|
| C-001 | Enterprise blueprint docs pack (`docs/` Parts 1–48 mapped) | Documentation | 2026-09-14 | CEO pack, market, PRD, SRS, architecture, ADRs, plans |
| C-002 | Artifact briefs for each doc (`artifacts/`) | Documentation | 2026-09-14 | Generator + manual CEO briefs |
| C-003 | Management overview (`docs/31-management-overview.md`) | Documentation | 2026-09-14 | Management presentation narrative |
| C-004 | Manager weekly timeline + PDF/HTML | Documentation | 2026-09-16 | Dates assumed from 21 Sep 2026 |
| C-005 | Decision log + Progress tracker created | Process | 2026-09-17 | This file + `Decision.md` |
| C-006 | Monorepo scaffold (`apps/api`, `apps/web`, Docker Compose) | Foundation | 2026-09-17 | NestJS + React Vite + Prisma + Postgres on :5440 |
| C-007 | Local authentication + login screens | Feature (P0) | 2026-09-17 | login/refresh/logout/me; Login UI; seed admin; verified API |
| C-008 | RBAC foundation (roles, permissions, assign UI) | Feature (P0) | 2026-09-17 | SRS role catalog; PermissionsGuard; assign/revoke; 403 verified |
| C-009 | Five-portal app shell (ESS/Manager/HR/Admin/Exec) | Foundation | 2026-09-17 | **Superseded by C-011** — portal switcher model retired |
| C-010 | Forgot password via email OTP | Feature | 2026-09-17 | Request/verify/confirm; Mailpit Stage A; anti-enumeration; session revoke |
| C-011 | Unified shell + role-grouped nav (Me/Team/HR/Admin/Leadership) | Foundation | 2026-09-22 | D-028; no portal switcher; smart Home teasers; path namespaces kept |
| C-012 | Dark mode (light / dark / system) | Foundation | 2026-09-22 | D-029; Design44 semantic tokens; localStorage; shell + auth toggle |
| C-013 | Shell UX depth (collapse + icons) | Foundation | 2026-09-23 | D-030; Lucide nav icons; section dividers; elevated main pad |

---

## To Do

### A. Sprint 0 / foundation (before feature modules)

| ID | Feature / work item | Priority | Target week | Status |
|----|---------------------|----------|-------------|--------|
| T-001 | Confirm CEO APPROVE WITH CONDITIONS in writing | P0 | Week 1 | Not started |
| T-002 | HR workshops + P0 scope freeze sign-off | P0 | Week 1–2 | Not started |
| T-003 | greytHR export discovery (employees, org, leave balances, attendance sample) | P0 | Week 1–2 | Not started |
| T-004 | UX wireframes: ESS home, leave request, manager inbox, employee profile | P0 | Week 2 | Not started |
| T-006 | CI pipeline (lint/test/build) on GitHub Actions free tier | P0 | Week 3–4 | Not started |
| T-007 | OpenAPI baseline | P0 | Week 3–4 | Not started |

### B. P0 product features (MVP — must implement)

| ID | Feature | Priority | Target week | Status |
|----|---------|----------|-------------|--------|
| T-012 | Audit log for sensitive actions | P0 | Week 4 | Not started |
| T-013 | Core HR — org (dept, designation, location) | P0 | Week 5 | Not started |
| T-014 | Core HR — employee master + manager hierarchy + search | P0 | Week 5 | Not started |
| T-015 | Leave — policies/types, balances, holidays | P0 | Week 6 | Not started |
| T-016 | Leave — apply / approve / reject | P0 | Week 6–7 | Not started |
| T-017 | Workflow engine v1 (sequential + role/manager approvers) | P0 | Week 7 | Not started |
| T-018 | Manager approvals inbox | P0 | Week 7 | Not started |
| T-019 | Workflow reminders (pending approvals) | P0 | Week 7–9 | Not started |
| T-020 | Attendance — daily mark | P0 | Week 8 | Not started |
| T-021 | Attendance — CSV import hook | P0 | Week 8 | Not started |
| T-022 | Attendance — correction request + approval | P0 | Week 8 | Not started |
| T-023 | Me / ESS modules (home + leave/attendance/docs/people/profile) | P0 | Week 9 | In progress — mock ESS UI in unified shell; APIs still open |
| T-024 | Team / manager modules (inbox + team views) | P0 | Week 9 | Not started — nav section wired; pages still placeholders |
| T-025 | Documents — upload, version metadata, ACL download | P0 | Week 9–10 | Not started |
| T-026 | Notifications — in-app + email | P0 | Week 10 | Not started |
| T-027 | Reports — headcount, leave utilization, attendance summary, basic attrition | P0 | Week 10 | Not started |
| T-028 | greytHR-oriented CSV/Excel migration + reconciliation report | P0 | Week 11 | Not started |
| T-029 | Security hardening + UAT with HR | P0 | Week 11 | Not started |
| T-030 | Pilot go-live (subset of users) + training + KPI baseline | P0 | Week 12 | Not started |

### C. P1 stretch (only if capacity remains)

| ID | Feature | Priority | Target | Status |
|----|---------|----------|--------|--------|
| T-040 | Workflow escalation / SLA reassignment | P1 | After P0 | Not started |
| T-041 | Workflow delegation | P1 | After P0 | Not started |
| T-042 | Light ATS (requisition → candidate → status) | P1 | After P0 | Not started |
| T-043 | Onboarding checklists | P1 | After P0 | Not started |
| T-044 | IT asset assignment | P1 | After P0 | Not started |
| T-045 | Simple HR helpdesk tickets | P1 | After P0 | Not started |

### D. Explicitly deferred (track, do not build in MVP)

| ID | Feature | Priority | Status |
|----|---------|----------|--------|
| T-090 | Full Indian statutory payroll engine | P2 | Deferred |
| T-091 | Performance / OKR suite | P2 | Deferred |
| T-092 | LMS / training engine | P2 | Deferred |
| T-093 | Expenses engine | P2 | Deferred |
| T-094 | Native mobile apps | P2 | Deferred |
| T-095 | WhatsApp / AI agents | P2 | Deferred |
| T-096 | Commercial billing / SCIM / marketplace | P2 | Deferred |
| T-097 | AKS / microservices split | P2 | Deferred |

---

## How to update

1. When a feature is implemented and demoable: move its row from **To Do** to **Completed** (new `C-xxx`), set date, add short notes.  
2. When a decision changes scope: add a row in `Decision.md`, then adjust **To Do** here.  
3. Do not mark documentation-only work as a product feature completion.
