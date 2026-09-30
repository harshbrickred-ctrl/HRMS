# Progress

**Product:** PeopleOS (internal HRMS)  
**Last updated:** 2026-09-30  

**Rule:** Set **Status** to **Completed** only when the feature is implemented and demoable (not when merely documented).  
**Related:** [Decision.md](Decision.md) · [docs/05-product-requirements-mvp.md](docs/05-product-requirements-mvp.md) · [docs/32-manager-weekly-timeline.md](docs/32-manager-weekly-timeline.md)

The database still holds tenants, users, roles, permissions, refresh tokens, password-reset OTPs, and audit events. There is no employee, leave, or attendance table. Those screens run from browser mock data (`apps/web/src/ess/mock`, `apps/web/src/workspace`). A leave or attendance request reaches the team manager only in the same browser session; a reload clears it. Users & Roles is the one workspace page backed by the API.

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
| T-001 | Confirm CEO APPROVE WITH CONDITIONS in writing | To-Do | P0, Week 1 |
| T-002 | HR workshops + P0 scope freeze sign-off | To-Do | P0, Week 1–2 |
| T-003 | greytHR export discovery (employees, org, leave balances, attendance sample) | To-Do | P0, Week 1–2 |
| T-004 | UX wireframes: ESS home, leave request, manager inbox, employee profile | To-Do | P0, Week 2 |
| T-006 | CI pipeline (lint/test/build) on GitHub Actions free tier | To-Do | P0, Week 3–4 |
| T-007 | OpenAPI baseline | To-Do | P0, Week 3–4 |
| T-012 | Audit log for sensitive actions | To-Do | P0, Week 4. Login, password reset, and role changes write `AuditEvent`; no query API. Admin audit screen is mock |
| T-013 | Core HR — org (dept, designation, location) | To-Do | P0, Week 5. Demo mock — departments and teams on HR Organization; not in Postgres |
| T-014 | Core HR — employee master + manager hierarchy + search | To-Do | P0, Week 5. Demo mock — directory, organization ids (`HY213`), department → team → manager. No employee API |
| T-015 | Leave — policies/types, balances, holidays | To-Do | P0, Week 6. Demo mock — balances, meters, and a month-grouped holiday calendar |
| T-016 | Leave — apply / approve / reject | To-Do | P0, Week 6–7. Demo mock — apply, withdraw, and approve in the manager inbox for this browser session only |
| T-017 | Workflow engine v1 (sequential + role/manager approvers) | To-Do | P0, Week 7. HR Workflows is a static list. Approver is hardcoded as the team manager in the mock |
| T-018 | Manager approvals inbox | To-Do | P0, Week 7. Demo mock — inbox, team leave, and team attendance filter to the signed-in manager’s team |
| T-019 | Workflow reminders (pending approvals) | To-Do | P0, Week 7–9. Admin Jobs is a static list |
| T-020 | Attendance — daily mark | To-Do | P0, Week 8. Demo mock — month calendar, register, and mark-present for the demo day |
| T-021 | Attendance — CSV import hook | To-Do | P0, Week 8. HR Migration only pretends to accept a file |
| T-022 | Attendance — correction request + approval | To-Do | P0, Week 8. Demo mock — correction goes to the team manager in this browser session |
| T-023 | Me / ESS modules (home + leave/attendance/docs/people/profile) | To-Do | P0, Week 9. Demo UI done, APIs open — home, leave, attendance, salary (payslip, YTD, PF), documents, people, profile, notifications, settings, helpdesk, My Team |
| T-024 | Team / manager modules (inbox + team views) | To-Do | P0, Week 9. Demo UI done, APIs open — manager overview, inbox, team leave, team attendance, directory. Placeholders removed |
| T-025 | Documents — upload, version metadata, ACL download | To-Do | P0, Week 9–10. Demo mock — mine/policies list and a local upload. No file storage or ACL |
| T-026 | Notifications — in-app + email | To-Do | P0, Week 10. In-app list is mock. Email exists only for password reset via Mailpit |
| T-027 | Reports — headcount, leave utilization, attendance summary, basic attrition | To-Do | P0, Week 10. Demo mock — HR Reports and Leadership screens use fixed figures |
| T-028 | greytHR-oriented CSV/Excel migration + reconciliation report | To-Do | P0, Week 11. Screen only |
| T-029 | Security hardening + UAT with HR | To-Do | P0, Week 11 |
| T-030 | Pilot go-live (subset of users) + training + KPI baseline | To-Do | P0, Week 12 |
| T-040 | Workflow escalation / SLA reassignment | To-Do | P1, after P0 |
| T-041 | Workflow delegation | To-Do | P1, after P0 |
| T-042 | Light ATS (requisition → candidate → status) | To-Do | P1, after P0 |
| T-043 | Onboarding checklists | To-Do | P1, after P0 |
| T-044 | IT asset assignment | To-Do | P1, after P0 |
| T-045 | Simple HR helpdesk tickets | To-Do | P1, after P0. Demo mock — ESS Helpdesk creates tickets in browser state only |
| T-090 | Full Indian statutory payroll engine | To-Do | P2, deferred |
| T-091 | Performance / OKR suite | To-Do | P2, deferred |
| T-092 | LMS / training engine | To-Do | P2, deferred |
| T-093 | Expenses engine | To-Do | P2, deferred |
| T-094 | Native mobile apps (store shipping) | To-Do | P2, deferred. Expo ESS client (C-014) has login plus mock home, leave, attendance, people, profile, documents, and notifications. Store, push, and offline still open |
| T-095 | WhatsApp / AI agents | To-Do | P2, deferred |
| T-096 | Commercial billing / SCIM / marketplace | To-Do | P2, deferred |
| T-097 | AKS / microservices split | To-Do | P2, deferred |
