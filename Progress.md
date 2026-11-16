# Progress

**Product:** PeopleOS (internal HRMS)  
**Last updated:** 2026-11-13  

**Rule:** Set **Status** to **Completed** only when the feature is implemented and demoable (not when merely documented).  
**Related:** [Decision.md](Decision.md) · [docs/05-product-requirements-mvp.md](docs/05-product-requirements-mvp.md) · [docs/34-feature-catalog.md](docs/34-feature-catalog.md) · [docs/33-implemented-workflow-catalog.md](docs/33-implemented-workflow-catalog.md) · [docs/36-product-guide-sales-leadership.md](docs/36-product-guide-sales-leadership.md) · [docs/32-manager-weekly-timeline.md](docs/32-manager-weekly-timeline.md)

**Authoritative feature status:** use [docs/34-feature-catalog.md](docs/34-feature-catalog.md) for Live / Partial / Planned. This tracker summarises programme completion; do not treat older “Demo mock” wording in historical notes as current truth.

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| C-001 | Enterprise blueprint docs pack (`docs/` Parts 1–48 mapped) | Completed | 2026-09-14. CEO pack, market, PRD, SRS, architecture, ADRs, plans |
| C-002 | Artifact briefs for each doc (`artifacts/`) | Completed | 2026-09-14. Generator + manual CEO briefs |
| C-003 | Management overview (`docs/31-management-overview.md`) | Completed | 2026-09-14. Management presentation narrative |
| C-004 | Manager weekly timeline + PDF/HTML | Completed | 2026-09-16. Dates assumed from 21 Sep 2026 |
| C-005 | Decision log + Progress tracker created | Completed | 2026-09-17. This file + `Decision.md` |
| C-006 | Monorepo scaffold (`apps/api`, `apps/web`, Docker Compose) | Completed | 2026-09-17. NestJS + React Vite + Prisma + Postgres on :5440 |
| C-007 | Local authentication + login screens | Completed | 2026-09-17. login/refresh/logout/me; Login UI; seed admin; verified API |
| C-008 | RBAC foundation (roles, permissions, assign UI) | Completed | 2026-09-17. SRS role catalog; PermissionsGuard; assign/revoke; 403 verified |
| C-009 | Five-portal app shell (ESS/Manager/HR/Admin/Exec) | Completed | 2026-09-17. Superseded by C-011 — portal switcher model retired |
| C-010 | Forgot password via email OTP | Completed | 2026-09-17. Request/verify/confirm; Mailpit Stage A; anti-enumeration; session revoke |
| C-011 | Unified shell + role-grouped nav (Me/Team/HR/Admin/Leadership) | Completed | 2026-09-22. D-028; no portal switcher; smart Home teasers; path namespaces kept |
| C-012 | Dark mode (light / dark / system) | Completed | 2026-09-22. D-029; Design44 semantic tokens; localStorage; shell + auth toggle |
| C-013 | Shell UX depth (collapse + icons) | Completed | 2026-09-23. D-030; Lucide nav icons; section dividers; elevated main pad |
| C-014 | Expo mobile app + web Mobile preview | Completed | 2026-09-23. D-031; Design44 in-web demo from login icon + `/mobile`; Expo ESS client |
| C-015 | Signed-in password change | Completed | 2026-09-29. `POST /api/v1/auth/password/change`; Settings screen calls it and revokes other sessions |
| C-016 | As-built docs refresh + sales/leadership product guide | Completed | 2026-11-13. Rewrote `docs/33`, `docs/34`; added `docs/36`; updated `docs/00-README` |
| C-017 | Core HR — org + employee master in Postgres | Completed | Live: departments, teams, locations, employee CRUD (`/hr/*`) |
| C-018 | Leave apply / withdraw / approve + balances | Completed | Live ESS + manager inbox/team leave; HR leave admin |
| C-019 | Attendance SoR (web punch, corrections, HR admin, eSSL path) | Completed | Live; PeopleOS is attendance system of record |
| C-020 | Documents + payslip PDF upload/download | Completed | Live Document Center + ESS documents/salary PDFs |
| C-021 | In-app notifications | Completed | Live inbox; email still password-reset only |
| C-022 | Helpdesk (employee self-service) | Completed | Live create/list; HR manage UI still Partial |
| C-023 | IT asset lifecycle + My Assets | Completed | Live register, requests, allocate/return, maintenance, tickets; no exit clearance |
| C-024 | Leadership live report KPIs | Completed | `/exec` + `/api/v1/reports/summary` |
| T-001 | Confirm CEO APPROVE WITH CONDITIONS in writing | To-Do | P0, Week 1 |
| T-002 | HR workshops + P0 scope freeze sign-off | To-Do | P0, Week 1–2 |
| T-003 | greytHR export discovery (employees, org, leave balances, attendance sample) | To-Do | Optional one-time import only; continuous punch sync out of scope |
| T-004 | UX wireframes: ESS home, leave request, manager inbox, employee profile | To-Do | P0; much of UI already shipped — close out formally |
| T-006 | CI pipeline (lint/test/build) on GitHub Actions free tier | To-Do | P0 |
| T-007 | OpenAPI baseline | To-Do | P0 |
| T-012 | Audit log query API + real Admin audit UI | To-Do | P0. Events are written; Admin Audit screen still mock |
| T-017 | Workflow engine v1 (sequential + role/manager approvers) | To-Do | P0/P1. Today = live queue dashboard only (`/hr/workflows`) |
| T-019 | Workflow reminders (pending approvals) | To-Do | P0. Admin Jobs still static |
| T-021 | Attendance — CSV import hook / bulk migration | To-Do | P0. Optional; product is independent SoR |
| T-026b | Email for leave / attendance decisions | To-Do | P0. Beyond password-reset Mailpit path |
| T-027b | Wire HR helpdesk manage UI to existing APIs | To-Do | P0. APIs + `helpdesk.manage` exist |
| T-028 | greytHR-oriented CSV/Excel migration + reconciliation report | To-Do | P0. Thin / planned |
| T-029 | Security hardening + UAT with HR | To-Do | P0 |
| T-030 | Pilot go-live (subset of users) + training + KPI baseline | To-Do | P0 |
| T-040 | Workflow escalation / SLA reassignment | To-Do | P1, after P0 |
| T-041 | Workflow delegation | To-Do | P1, after P0 |
| T-042 | Light ATS (requisition → candidate → status) | To-Do | P1, after P0 |
| T-043 | Onboarding checklists | To-Do | P1, after P0 |
| T-044b | Asset exit clearance (needs exit / F&F) | To-Do | P1. Core asset module Completed as C-023 |
| T-090 | Full Indian statutory payroll engine | To-Do | P2, deferred |
| T-091 | Performance / OKR suite | To-Do | P2, deferred |
| T-092 | LMS / training engine | To-Do | P2, deferred |
| T-093 | Expenses engine | To-Do | P2, deferred |
| T-094 | Native mobile apps (store shipping) | To-Do | P2. Expo: login + attendance Live; leave/docs/etc. still mock |
| T-095 | WhatsApp / AI agents | To-Do | P2, deferred |
| T-096 | Commercial billing / SCIM / marketplace | To-Do | P2, deferred |
| T-097 | AKS / microservices split | To-Do | P2, deferred |
