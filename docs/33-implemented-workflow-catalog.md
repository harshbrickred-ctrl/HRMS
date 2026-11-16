# 33 — Implemented workflow catalog

**Product:** PeopleOS  
**Status:** Inventory of the running app. Not a target design.  
**Last updated:** 2026-11-13  
**Related:** [08-process-flows](08-process-flows.md) (intended process) · [34-feature-catalog](34-feature-catalog.md) · [36-product-guide-sales-leadership](36-product-guide-sales-leadership.md) · [Progress.md](../Progress.md)

This catalog lists workflows that exist in `apps/web`, `apps/api`, and `apps/mobile`. Where [08-process-flows](08-process-flows.md) and the code disagree, **this file follows the code**. Specified processes that are missing or only mocked are listed at the end.

---

## 1. How to read this catalog

A workflow is a multi-step handoff a person starts, continues, or finishes: apply, approve, reject, withdraw, upload, assign a role, reset a password, raise a ticket, issue an asset, and similar steps.

| Maturity | Meaning |
|----------|---------|
| **Live** | Persisted through the API and Postgres. Survives a reload. |
| **Session mock** | Works in the UI. Stored only in browser state for this session. |
| **Static** | A screen or list with no real state change. |
| **Specified only** | Described in `docs/` and not present in `apps/`. |

**Nav and gates:** Sidebar from `navSectionsForUser` in [`apps/web/src/layout/appNav.ts`](../apps/web/src/layout/appNav.ts). Route gates in [`apps/web/src/App.tsx`](../apps/web/src/App.tsx). Permissions in [`apps/api/src/rbac/role-matrix.ts`](../apps/api/src/rbac/role-matrix.ts).

**Still mock (do not treat as Live workflows):** Manager Overview and Team Directory (`workspaceMock`); Admin Audit / Notifications / Settings / Jobs; large parts of ESS Home widgets, My Team, and Salary sample FY panels; mobile leave/docs/people/notifications.

---

## 2. Role and responsibility matrix

| Role | Navigation | Key Live actions |
|------|------------|------------------|
| **EMPLOYEE** | Me only (`/ess/*`) | Leave apply/withdraw; attendance punch + correction; documents; helpdesk create; payslip download; My Assets request / fault / loss / acknowledge; change password |
| **MANAGER** | Me + Approvals + Team Time + Directory | Approve/reject leave and attendance corrections (Inbox, Team Leave, Team Attendance); own ESS |
| **HR_EXEC** | Me + People + Time + Programs | Employees, org, leave balances, attendance admin (shifts, holidays, devices, override, lock, register), Document Center + payslip upload, Workflows queues |
| **HR_HEAD** | Same as HR_EXEC **+ Assets** | All HR_EXEC actions plus full IT asset lifecycle |
| **IT_ADMIN** | Me + Access/Platform + Assets | Users & Roles; Admin leave approvals; asset register / requests / allocate / maintenance / reports / tickets; device manage permission |
| **SECURITY_ADMIN** | Me + Access/Platform | Users & Roles; Admin leave approvals; audit.read (Admin Audit UI still Static) |
| **LEADERSHIP_READ** | Me + Leadership | Overview / Reports with live summary KPIs |
| **FINANCE_READ** | Me only (no Finance section) | payslip.self + reports.read; no dedicated Finance screens |

Seed users: [Credentials.md](../Credentials.md). `HR_HEAD`, `LEADERSHIP_READ`, and `FINANCE_READ` are in the role catalog; assign via `/admin/roles` for demos.

---

## 3. Authentication & account

### 3.1 Sign in — Live

1. User opens `/login`, enters email + password.  
2. API issues access + refresh tokens.  
3. App lands on `/ess` (Home). Sidebar sections appear from roles.

### 3.2 Forgot password (OTP) — Live

1. `/forgot-password` → email submitted.  
2. OTP sent (Mailpit locally / SMTP in deploy).  
3. `/forgot-password/otp` → verify code.  
4. `/forgot-password/reset` → new password; other sessions revoked.

### 3.3 Change password — Live

1. Signed-in user opens `/ess/settings`.  
2. Submits current + new password.  
3. API updates hash and revokes other refresh sessions.

---

## 4. Leave

### 4.1 Apply leave — Live

1. Employee opens `/ess/leave`.  
2. Chooses type, dates, optional half-day, reason → submit.  
3. Balance moves days into **pending**.  
4. Manager sees item in `/manager/inbox` and `/manager/team-leave`.

### 4.2 Withdraw pending leave — Live

1. Employee withdraws a **pending** request on `/ess/leave`.  
2. Pending balance is released.

### 4.3 Manager decide leave — Live

1. Manager opens Inbox or Team Leave.  
2. Approves or rejects with optional comment.  
3. On approve: pending → used; attendance days in range can be marked leave.  
4. On reject: pending released. In-app notification to employee.

### 4.4 Admin / company leave decide — Live

1. Security or IT Admin with `leave.approve` opens `/admin/leave`.  
2. Decides company-scoped leave requests (same decide APIs).

### 4.5 HR leave balance admin — Live

1. HR opens `/hr/leave`.  
2. Views / adjusts leave balances for employees (`leave.manage`).

---

## 5. Attendance

### 5.1 Web punch — Live

1. Employee punches from `/ess` Home or `/ess/attendance` (if policy allows web punch).  
2. Day summary updates (in/out, late/early per policy).

### 5.2 Month view & day detail — Live

1. Employee opens `/ess/attendance`.  
2. Sees calendar of statuses, punches, exceptions.

### 5.3 Correction request → manager decide — Live

1. Employee requests a correction for a day.  
2. Manager decides on Inbox / Team Attendance.  
3. Approved correction rebuilds the day; notification emitted.

### 5.4 Biometric device (eSSL iClock ADMS) — Live

1. Device handshakes with API; ATTLOG punches push into PeopleOS.  
2. HR/IT register devices and enroll employee PINs on `/hr/attendance` (no biometric templates stored).  
3. Unmatched PINs appear in enrollment / Workflows queues for mapping.

### 5.5 HR attendance admin — Live

On `/hr/attendance` (permissions: manage / override / period.lock / device.manage as assigned):

- Maintain shifts, assignments, holidays, policy.  
- Override a day with reason.  
- Lock a month (late punches stored; day frozen unless override).  
- Download monthly register CSV.  
- Work exceptions and unmatched PIN queue.

---

## 6. Core HR & documents

### 6.1 Organization structure — Live

1. HR opens `/hr/organization`.  
2. Creates / edits / deletes departments, teams, locations.

### 6.2 Employee master — Live

1. HR opens `/hr/employees`.  
2. Creates or updates employee records (code, manager, dept, location, team).  
3. Directory consumers (`/ess/people`, APIs) read from the same store.

### 6.3 Document Center → employee vault — Live

1. HR uploads files on `/hr/documents` (employee docs and/or payslip PDF for a month).  
2. Employee downloads on `/ess/documents` and payslip PDFs on `/ess/salary`.

### 6.4 Workflows queue dashboard — Live (queues only)

1. HR opens `/hr/workflows`.  
2. Sees live counts for pending leave, attendance corrections, unmatched PINs, helpdesk — **not** a configurable workflow engine.

---

## 7. Helpdesk

### 7.1 Employee raise ticket — Live

1. Employee opens `/ess/helpdesk`.  
2. Creates ticket (category, subject, body); lists own tickets.

### 7.2 HR manage tickets — Partial

- Company list + status update APIs exist (`helpdesk.manage`).  
- **No dedicated HR helpdesk screen** wired in the web app. Status changes may be exercised via API or reflected in Workflows queue counts only.

---

## 8. Notifications

### 8.1 In-app inbox — Live

1. System emits events (leave decide, correction decide, ticket status, payslip upload, etc.).  
2. Employee opens `/ess/notifications`, marks read / read all.

### 8.2 Email beyond password reset — Specified only / Partial

Password-reset email is Live. Decision emails for leave/attendance are **not** sent yet (in-app only).

---

## 9. Manager team workflows

| Workflow | Path | Maturity |
|----------|------|----------|
| Inbox (leave + attendance corrections) | `/manager/inbox` | **Live** |
| Team Leave | `/manager/team-leave` | **Live** |
| Team Attendance | `/manager/team-attendance` | **Live** |
| Manager Overview | `/manager` | **Session mock** / Static counts |
| Team Directory | `/manager/directory` | **Session mock** |

---

## 10. Admin / security

### 10.1 Users & Roles — Live

1. User with `rbac.assign` (Security Admin or IT Admin) opens `/admin/roles`.  
2. Selects a user, toggles role codes, saves.  
3. Next session / refresh updates sidebar and API permissions.

### 10.2 Admin leave approvals — Live

`/admin/leave` — company-wide leave decisions for roles with `leave.approve`.

### 10.3 Admin platform pages — Static

| Path | Content |
|------|---------|
| `/admin` | Overview KPIs largely mock |
| `/admin/audit` | Mock audit list |
| `/admin/notifications` | Mock mail health |
| `/admin/settings` | Session-only toggles |
| `/admin/jobs` | Static job list |

Audit **events** are written for many sensitive actions in the API; the Admin Audit UI does not yet query them.

---

## 11. Leadership

### 11.1 Overview & Reports — Live

1. User with `LEADERSHIP_READ` opens `/exec` or `/exec/reports`.  
2. Figures load from `/api/v1/reports/summary` (headcount, on leave, exceptions, awaiting approval, etc.).

---

## 12. Assets

Detailed data model: [35-asset-module-data-model.md](35-asset-module-data-model.md).

### 12.1 Employee My Assets — Live

1. Employee opens `/ess/assets` (detail, history, fault, lost, reports as linked).  
2. Views assigned kit; acknowledges issue/handover; requests new asset; reports fault or loss with files.

### 12.2 Request → approve → issue — Live

1. Employee submits request from My Assets.  
2. Manager / department head / configured approvers act on the request path.  
3. IT Admin or HR Head issues from `/it/requests` / allocate flows (`/it/allocate`, return, transfer, employee-assets).

### 12.3 Asset register & lifecycle — Live

IT Admin / HR Head on `/it/*`:

- Dashboard, register (CRUD, photo, CSV sample/import), categories, approvers.  
- Allocate / return / transfer with condition and history.  
- Status changes with reason; maintenance & warranty.  
- Reports + CSV.  
- Ticket inbox `/it/tickets` — reply and progress; cannot process own report.

### 12.4 Asset exit clearance — Specified only

Not built (depends on exit / F&F).

---

## 13. Mobile (Expo)

| Workflow | Maturity |
|----------|----------|
| Login against API | **Live** |
| Attendance month + punch | **Live** |
| Leave, documents, people, notifications, home extras | **Session mock** |

---

## 14. Specified or mock-only (not drawn as built)

| Item | Status |
|------|--------|
| Full workflow engine / SLA / delegation | Specified only |
| Email digests for approvals | Specified only |
| Admin audit query UI | Static (events exist) |
| Admin jobs runner | Static |
| Manager overview / team directory | Session mock |
| greytHR continuous sync | Out of product direction (PeopleOS SoR) |
| Bulk CSV migration | Thin / Planned |
| Full payroll calculator | Deferred (payslip PDF upload only) |
| Asset exit clearance | Specified only |
| Finance product area | Role only; no sidebar |

---

## 15. Demo path (seed)

Password for all seeded users: `ChangeMe123!` (see [Credentials.md](../Credentials.md)).

| Email | Best workflow demo |
|-------|--------------------|
| `employee@peopleos.local` | Leave apply, punch, docs, My Assets, helpdesk, salary PDF |
| `manager@peopleos.local` | Inbox leave/attendance decide for direct reports |
| `hr@peopleos.local` | Employees, org, leave balances, attendance admin, documents, workflows |
| `it@peopleos.local` | Asset register, allocate/return, tickets; Admin roles |
| `admin@peopleos.local` | Users & Roles; Admin leave |

Assign `LEADERSHIP_READ` or `HR_HEAD` via `/admin/roles` to demo Leadership or HR+Assets.

---

## Related

- [34-feature-catalog.md](34-feature-catalog.md) — feature maturity  
- [08-process-flows.md](08-process-flows.md) — intended (target) flows  
- [36-product-guide-sales-leadership.md](36-product-guide-sales-leadership.md) — non-technical product & role guide  
- [Credentials.md](../Credentials.md) — local URLs and seed logins  
