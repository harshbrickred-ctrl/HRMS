# PeopleOS — Feature Catalog

**Product:** PeopleOS (internal HRMS)  
**As of:** 13 Nov 2026 (running codebase under `apps/`)  
**Note:** [Progress.md](../Progress.md) may lag the running app. This catalog is the authoritative Live / Partial / UI-only / Planned inventory. Cross-check workflows in [33-implemented-workflow-catalog.md](33-implemented-workflow-catalog.md). Non-technical product narrative: [36-product-guide-sales-leadership.md](36-product-guide-sales-leadership.md).

### How to read maturity

| Label       | Meaning                                            |
| ----------- | -------------------------------------------------- |
| **Live**    | Saved in Postgres; survives reload; API + UI wired |
| **Partial** | Some of it is live; gaps listed                    |
| **UI only** | Screen exists; data is mock/static or incomplete   |
| **Planned** | Intended later; not built                          |

Sources of truth for “who sees what”: [`apps/web/src/layout/appNav.ts`](../apps/web/src/layout/appNav.ts), [`apps/web/src/App.tsx`](../apps/web/src/App.tsx), [`apps/api/src/rbac/role-matrix.ts`](../apps/api/src/rbac/role-matrix.ts).

---

## 1. Implemented today (Live)

### Platform & identity

| Feature                                             | Who              | What you get                         |
| --------------------------------------------------- | ---------------- | ------------------------------------ |
| Login / logout / refresh JWT                        | All              | Email + password                     |
| Forgot password (email OTP)                         | All              | Via Mailpit locally / SMTP on deploy |
| Change password                                     | All              | Settings; revokes other sessions     |
| Roles & permissions (RBAC)                          | Security / IT Admin | Assign/revoke roles on Users & Roles |
| Unified shell (Me + role sections)                  | By role          | One app, role-based sidebar          |
| Dark mode                                           | All              | Light / dark / system                |
| Health check                                        | Ops              | `/api/v1/health`                     |

### Core HR

| Feature                       | Who                | What you get                               |
| ----------------------------- | ------------------ | ------------------------------------------ |
| Departments, locations, teams | HR Exec / HR Head  | Create / edit / delete                     |
| Employee master               | HR Exec / HR Head  | CRUD, manager, dept, location, team, codes |
| Directory                     | Employee / Manager | People list from API                       |
| Leave balances (ledger)       | HR + Employee      | Entitled / used / pending; HR can edit     |
| Employee documents            | HR + Employee      | Upload / download / delete (file storage)  |

### Leave (workflow)

| Feature                      | Who                 | What you get                          |
| ---------------------------- | ------------------- | ------------------------------------- |
| Apply leave                  | Employee+           | Types, dates, half-day, reason        |
| Withdraw pending             | Employee+           | Releases pending balance              |
| Approve / reject             | Manager             | Inbox + team leave                    |
| Company-wide leave decide    | Security / IT Admin | `/admin/leave` (leave.approve)        |
| Balance update on decide     | System              | Pending → used (or release on reject) |
| Mark attendance as leave     | System              | Working days in range set to leave    |
| Holiday calendar on leave UI | Employee            | From attendance holidays              |

### Attendance (PeopleOS is system of record — no greytHR punch sync)

| Feature                      | Who          | What you get                                             |
| ---------------------------- | ------------ | -------------------------------------------------------- |
| Web punch in/out             | Employee     | If policy allows                                         |
| Month calendar / day detail  | Employee     | Status, punches, late/early                              |
| Correction request           | Employee     | To reporting manager                                     |
| Approve / reject correction  | Manager      | Rebuilds the day                                         |
| Shifts + assignments         | HR           | e.g. General 09:00–18:00                                 |
| Holidays                     | HR           | Company holidays                                         |
| Policy                       | HR           | Grace, half-day, web punch, duplicate window             |
| HR override                  | HR           | Force day status with reason                             |
| Month lock                   | HR           | Late punches stored; day frozen unless override          |
| Monthly register CSV         | HR           | Download from day summaries                              |
| Exceptions queue             | HR / Manager | Absences, missing punch, half day                        |
| **eSSL iClock ADMS**         | Device → API | Handshake, ATTLOG push, enrollment queue, unmatched PINs |
| Device register / PIN enroll | HR / IT      | No biometric templates stored                            |

### Notifications

| Feature      | Who                | What you get                                              |
| ------------ | ------------------ | --------------------------------------------------------- |
| In-app inbox | Employee / Manager | Persist; mark read / read all                             |
| Event emit   | System             | Leave, correction decision, ticket status, payslip upload |

### Helpdesk

| Feature                | Who      | What you get                           |
| ---------------------- | -------- | -------------------------------------- |
| Create / list tickets  | Employee | Category, subject, body                |
| Status update API      | HR       | Open → In progress → Resolved / Closed (API live; **no dedicated HR ticket UI** — see Partial) |

### Payslips

| Feature             | Who      | What you get                              |
| ------------------- | -------- | ----------------------------------------- |
| Upload PDF          | HR       | Per employee + month (Document Center)    |
| List + download PDF | Employee | ESS Salary — **not** a payroll calculator |
| YTD, IT statement, declaration, loans, reimbursement, proofs, revision | Employee | Sample FY figures on the Salary page. Not calculated and not stored |

### Reports & queues

| Feature        | Who             | What you get                                                                                        |
| -------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| Summary KPIs   | HR / Leadership | Headcount, on leave, exceptions, open tickets, etc. (`/api/v1/reports/summary`)                     |
| Workflows page | HR              | **Live queues** (pending leave, corrections, unmatched PINs, helpdesk) — not a full workflow engine |
| Leadership Overview / Reports | Leadership Read | Live counts via same reports API                                                          |

### Mobile (Expo)

| Feature                  | Who      | What you get         |
| ------------------------ | -------- | -------------------- |
| Login                    | Employee | Against API          |
| Attendance month + punch | Employee | Same self API as web |

### Assets

Statuses: In Stock, Allocated, Under Maintenance, Lost, Retired, Disposed, Written Off. Every status change records who, when, and why.

| Feature | Who | What you get |
|---------|-----|----------------|
| Dashboard | IT Admin, HR Head | Totals by status and category |
| Categories | IT Admin, HR Head | Add, edit, or deactivate; tag prefix and custom fields per category |
| Asset master | IT Admin, HR Head | Add, edit, view, search, filter; generated tag, optional unique serial, warranty, location, photo |
| Delete asset | IT Admin, HR Head | Only for an asset in stock with no history |
| Allocate, return, transfer | IT Admin, HR Head | Condition, accessories, inspection, photos; transfers keep the asset Allocated |
| Status changes | IT Admin, HR Head | Only the allowed moves, each with a reason |
| Asset and employee history | IT Admin, HR Head | Timeline, status history, every allocation, signed forms |
| Requests | Employee, Manager, Dept head, Asset admin | Employee requests, manager and department head approve, asset admin issues |
| Maintenance | IT Admin, HR Head | Repair records with vendor, cost, dates, and outcome; returns needing repair open one automatically |
| Reports | IT Admin, HR Head | Stock, allocations, employee-wise, overdue, warranty, department cost, history; CSV download |
| My Assets | Employee | Own assets, acknowledge receipt or handover, signed forms, asset history |
| Fault and loss reports | Employee | Reference number, status, photos and documents; an admin reviews them and makes any status change |
| Ticket inbox | IT Admin, HR Head | Review reports and reply to the employee; nobody can process their own report (`/it/tickets`) |

Not built: asset exit clearance (needs employee exit / F&F process).

---

## 2. Partial / incomplete

| Area                  | Status    | Gap                                                                                                  |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| Audit                 | **Partial** | Events written for many actions; Admin Audit screen still mock; no full query API for Admin UI     |
| Email notifications   | **Partial** | Password reset email works; leave/approve etc. are **in-app only**                                 |
| Manager overview      | **Partial** | Inbox leave/attendance are live; overview dashboard counts still mix mock                          |
| Manager directory     | **UI only** | Team Directory still workspace mock                                                                |
| ESS Home              | **Partial** | Punch is live; many widgets still use session mock                                                 |
| ESS My Team / Profile | **Partial** | Mix of live employment/assets and mock enrichment                                                  |
| Documents ACL         | **Partial** | Upload/download works; fine-grained ACL / versioning / letter templates limited                    |
| Helpdesk manage UI    | **Partial** | Company ticket APIs + `helpdesk.manage` exist; no `/hr/helpdesk` screen — HR sees queues on Workflows only |
| Mobile                | **Partial** | Attendance live; leave, docs, notifications, people still largely mock                             |
| Production deploy     | **Partial** | App may be on Vercel; production DB still needs migrate + seed for new permissions                 |
| greytHR CSV migration | **UI only / planned** | Product decision: PeopleOS runs independently; bulk import still thin                        |

---

## 3. Planned — near term (finish P0 gaps)

| Feature                                    | Priority   | Notes                   |
| ------------------------------------------ | ---------- | ----------------------- |
| CI pipeline (GitHub Actions)               | P0         | Lint / test / build     |
| OpenAPI baseline                           | P0         | Public API contract     |
| Audit query API + real Admin audit UI      | P0         | Replace mock audit page |
| Email for leave / attendance decisions     | P0         | Beyond password reset   |
| Workflow reminders / digests               | P0         | Pending approval nudges |
| Admin Jobs (real job runner)               | P0         | Today static            |
| HR helpdesk manage screen                  | P0         | Wire existing APIs      |
| Employment events (join / transfer / exit) | P0         | Light lifecycle         |
| Bulk employee CSV import                   | P0         | Migration path          |
| Document letter templates                  | P0         | Light templates         |
| Mobile leave + notifications               | P0 stretch | Match web APIs          |
| Security hardening + HR UAT                | P0         | Before pilot            |
| Pilot go-live + training                   | P0         | Cohort rollout          |

**Product note:** Original plan mentioned greytHR export/sync. Current attendance/leave design treats **PeopleOS as independent SoR** (no greytHR punch sync). CSV migration can stay optional for one-time import only.

---

## 4. Planned — later (P1)

| Feature                       | Notes                                                                 |
| ----------------------------- | --------------------------------------------------------------------- |
| Full workflow engine          | Definitions, sequential/parallel steps (today = queue dashboard only) |
| Escalation / SLA reassignment | After workflow engine                                                 |
| Delegation                    | Manager out of office                                                 |
| Light ATS                     | Requisition → candidate → status                                      |
| Onboarding checklists         | New joiner tasks                                                      |
| Asset exit clearance          | After exit / F&F                                                      |

---

## 5. Deferred (P2 — not in near roadmap)

| Feature                                     |
| ------------------------------------------- |
| Full Indian statutory **payroll engine**    |
| Performance / OKR                           |
| LMS / training                              |
| Expenses engine                             |
| Store-shipped native mobile (push, offline) |
| WhatsApp / AI agents                        |
| Commercial billing / SCIM / marketplace     |
| AKS / microservices split                   |

---

## 6. Who sees what (quick map)

| Role                 | Sidebar / main live areas |
| -------------------- | ------------------------- |
| **Employee**         | Me: Home, Attendance, Leave, Salary, Documents, My Assets, People, My Team, Profile, Notifications, Settings, Helpdesk |
| **Manager**          | Me + Approvals (Overview, Inbox) + Team Leave / Team Attendance + Team Directory (directory still mock) |
| **HR Executive**     | Me + People (Overview, Employees, Organization) + Leave Admin / Attendance Admin + Document Center / Workflows |
| **HR Head**          | Same as HR Exec **plus** full Assets (same IT asset area) |
| **IT Admin**         | Me + Access/Platform (Admin) + Assets |
| **Security Admin**   | Me + Access/Platform; Users & Roles; Admin leave approvals |
| **Leadership Read**  | Me + Leadership Overview / Reports (live KPIs) |
| **Finance Read**     | Role exists; **no Finance sidebar** — payslip.self + reports.read only |

Seed logins (local): see [Credentials.md](../Credentials.md). Roles `HR_HEAD`, `LEADERSHIP_READ`, `FINANCE_READ` exist in the catalog; assign via Users & Roles for demos.

---

## 7. One-page summary

**Built and durable:** Auth/RBAC, HR master + docs, leave apply/approve, attendance (web + eSSL + lock/register), in-app notifications, helpdesk (self + APIs), IT asset lifecycle, payslip PDFs, live report/queue KPIs, mobile attendance.

**Next useful work:** Production migrate/seed, audit UI, HR helpdesk screen, CI/OpenAPI, email on approvals, mobile leave/notifications, then real workflow engine / onboarding if needed.

**Explicitly not building soon:** Full payroll, PMS, LMS, expenses, WhatsApp/AI.

---

## Related

- [33-implemented-workflow-catalog.md](33-implemented-workflow-catalog.md) — as-built workflows
- [36-product-guide-sales-leadership.md](36-product-guide-sales-leadership.md) — sales / leadership product guide
- [Progress.md](../Progress.md) — tracker (may be stale vs this catalog)
- [05-product-requirements-mvp.md](05-product-requirements-mvp.md) — original MVP PRD
- [Decision.md](../Decision.md) — product decisions
- [35-asset-module-data-model.md](35-asset-module-data-model.md) — asset data model
