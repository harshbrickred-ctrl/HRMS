# PeopleOS — Feature Catalog

**Product:** PeopleOS (internal HRMS)  
**As of:** 19 Oct 2026 (code on `main`)  
**Note:** [Progress.md](../Progress.md) may lag the running app. This catalog matches implemented APIs and UI wiring.

### How to read maturity


| Label       | Meaning                                            |
| ----------- | -------------------------------------------------- |
| **Live**    | Saved in Postgres; survives reload; API + UI wired |
| **Partial** | Some of it is live; gaps listed                    |
| **UI only** | Screen exists; data is mock/static or incomplete   |
| **Planned** | Intended later; not built                          |


---

## 1. Implemented today (Live)

### Platform & identity


| Feature                                             | Who     | What you get                         |
| --------------------------------------------------- | ------- | ------------------------------------ |
| Login / logout / refresh JWT                        | All     | Email + password                     |
| Forgot password (email OTP)                         | All     | Via Mailpit locally / SMTP on deploy |
| Change password                                     | All     | Settings; revokes other sessions     |
| Roles & permissions (RBAC)                          | Admin   | Assign/revoke roles on Users & Roles |
| Unified shell (Me / Team / HR / Admin / Leadership) | By role | One app, role-based nav              |
| Dark mode                                           | All     | Light / dark / system                |
| Health check                                        | Ops     | `/api/v1/health`                     |




### Core HR


| Feature                       | Who                | What you get                               |
| ----------------------------- | ------------------ | ------------------------------------------ |
| Departments, locations, teams | HR                 | Create / edit / delete                     |
| Employee master               | HR                 | CRUD, manager, dept, location, team, codes |
| Directory                     | Employee / Manager | People list from API                       |
| Leave balances (ledger)       | HR + Employee      | Entitled / used / pending; HR can edit     |
| Employee documents            | HR + Employee      | Upload / download / delete (file storage)  |




### Leave (workflow)


| Feature                      | Who      | What you get                          |
| ---------------------------- | -------- | ------------------------------------- |
| Apply leave                  | Employee | Types, dates, half-day, reason        |
| Withdraw pending             | Employee | Releases pending balance              |
| Approve / reject             | Manager  | Inbox + team leave                    |
| Balance update on decide     | System   | Pending → used (or release on reject) |
| Mark attendance as leave     | System   | Working days in range set to leave    |
| Holiday calendar on leave UI | Employee | From attendance holidays              |




### Attendance (PeopleOS is system of record — no greytHR)


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
| Update status (+ note) | HR       | Open → In progress → Resolved / Closed |




### Payslips


| Feature             | Who      | What you get                              |
| ------------------- | -------- | ----------------------------------------- |
| Upload PDF          | HR       | Per employee + month (Document Center)    |
| List + download PDF | Employee | ESS Salary — **not** a payroll calculator |
| YTD, IT statement, declaration, loans, reimbursement, proofs, revision | Employee | Sample FY 2026-27 figures on the Salary page. Not calculated and not stored |




### Reports & queues


| Feature        | Who             | What you get                                                                                        |
| -------------- | --------------- | --------------------------------------------------------------------------------------------------- |
| Summary KPIs   | HR / Leadership | Headcount, on leave, exceptions, open tickets, etc.                                                 |
| Workflows page | HR              | **Live queues** (pending leave, corrections, unmatched PINs, helpdesk) — not a full workflow engine |




### Mobile (Expo)


| Feature                  | Who      | What you get         |
| ------------------------ | -------- | -------------------- |
| Login                    | Employee | Against API          |
| Attendance month + punch | Employee | Same self API as web |


### IT assets

| Feature | Who | What you get |
|---------|-----|----------------|
| Current assignments | Employee | Tag, category, model, serial, assigned date. Past owners are hidden |
| Issue, query, or new request | Employee | Sent to IT, separate from HR Helpdesk |
| Register, assign, return, history | IT Admin | Full inventory and assignment trail |
| Ticket inbox | IT Admin | Status updates and notes back to the employee |

HR does not manage assets.


---



## 2. Partial / incomplete


| Area                  | Status                | Gap                                                                                                  |
| --------------------- | --------------------- | ---------------------------------------------------------------------------------------------------- |
| Audit                 | **Partial**           | Events written for many actions; Admin Audit screen still mock; no full query API for HR/security UI |
| Email notifications   | **Partial**           | Password reset email works; leave/approve etc. are **in-app only**                                   |
| Manager overview      | **Partial**           | Inbox leave/attendance are live; some dashboard counts may still mix mock                            |
| ESS Home              | **Partial**           | Punch is live; some widgets still use session mock                                                   |
| Documents ACL         | **Partial**           | Upload/download works; fine-grained ACL / versioning / letter templates limited                      |
| Mobile                | **Partial**           | Attendance live; leave, docs, notifications, people still largely mock                               |
| Production deploy     | **Partial**           | App deployed on Vercel; production DB still needs migrate + seed for new permissions                 |
| greytHR CSV migration | **UI only / planned** | Product decision: PeopleOS runs independently; bulk import still thin                                |


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


| Role           | Main live areas                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Employee**   | Home, leave, attendance, documents, people, notifications, helpdesk, current assets, payslip PDFs, settings |
| **IT Admin**   | Asset register, assignment history, and asset tickets. Not an HR function |
| **Manager**    | Same + inbox (leave + attendance corrections), team leave, team attendance                                                        |
| **HR**         | Employees, org, leave balances, attendance admin (devices, lock, register), documents + payslip upload, workflows queues, reports |
| **Admin**      | Users & Roles; settings/jobs/audit still thin                                                                                     |
| **Leadership** | Summary reports (live counts)                                                                                                     |


---



## 7. One-page summary

**Built and durable:** Auth/RBAC, HR master + docs, leave apply/approve, attendance (web + eSSL + lock/register), in-app notifications, helpdesk, IT asset register, payslip PDFs, live report/queue KPIs, mobile attendance.

**Next useful work:** Production migrate/seed, audit UI, CI/OpenAPI, email on approvals, mobile leave/notifications, then real workflow engine / onboarding if needed.

**Explicitly not building soon:** Full payroll, PMS, LMS, expenses, WhatsApp/AI.

---



## Related

- [Progress.md](../Progress.md) — tracker (may be stale vs this catalog)
- [docs/05-product-requirements-mvp.md](05-product-requirements-mvp.md) — original MVP PRD
- [Decision.md](../Decision.md) — product decisions

