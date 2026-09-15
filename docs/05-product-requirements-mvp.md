# 05 — Product Requirements Document (MVP)

**Product:** PeopleOS — 12-week P0 MVP  
**Related:** [03-product-vision](03-product-vision.md) · [04-business-requirements](04-business-requirements.md) · [06-srs-functional](06-srs-functional.md) · [07-user-stories](07-user-stories.md)  
**Capacity context:** 4 engineers × 12 weeks; **Estimate** ~145–155 effective coding days after meetings/reviews; 15% contingency reserved in plan docs.

---

## Evidence labels

**Fact** | **Assumption** | **Estimate** | **Metric-to-measure**

---

## 1. PRD summary

| Item | Content |
|------|---------|
| Problem | greytHR-centered ops leave gaps in workflow clarity, attendance corrections, documents control, audit, and owned APIs; spreadsheets fill gaps. |
| Goal | Ship internal SoR for Identity/RBAC, Core HR, Leave, Attendance (mark/import + corrections), Workflow v1, Documents, ESS+Manager, Notifications, Audit, ops reports + greytHR CSV migration + Docker/OpenAPI/CI. |
| Non-goals | Full payroll engine, PMS, LMS, expenses, advanced BI, native mobile, WhatsApp, multi-country, billing, SCIM, AI agents, biometric farms. |
| Users | Employee, Manager, HR Exec, HR Head, IT/Sec Admin, Finance coordinator, Leadership (read). |
| Success | Pilot cohort live by week 12; migration dry-run pass; P0 AC met; no P2 items in release. |

---

## 2. Priority definitions

| Priority | Meaning |
|----------|---------|
| **P0** | Committed for week-12 release |
| **P1** | Stretch if capacity remains after P0 hardening |
| **P2** | Explicitly deferred |

Complexity: **S** ≤3d · **M** 3–8d · **L** 8–15d · **XL** >15d (**Estimate**, one engineer-equivalent).

---

## 3. Module | Feature | Priority | Complexity | Dependencies | Effort | MVP | Future Value

| Module | Feature | Priority | Complexity | Dependencies | Effort (est. eng-days) | MVP? | Future Value |
|--------|---------|----------|------------|--------------|------------------------|------|--------------|
| Identity | Local auth (email/password), session/JWT, password reset | P0 | M | — | 8 | Y | SSO/OIDC later |
| Identity | RBAC roles + permission checks API/UI | P0 | M | Identity | 10 | Y | Fine-grained ABAC |
| Identity | Soft lock on failed logins; audit login events | P0 | S | Identity, Audit | 3 | Y | Adaptive auth |
| Core HR | Org units, departments, designations, locations | P0 | M | Identity | 8 | Y | Multi-entity |
| Core HR | Employee profile CRUD + search | P0 | L | Org | 12 | Y | Employee 360 |
| Core HR | Employment events (join, transfer, promote, exit light) | P0 | M | Employee | 8 | Y | Full lifecycle engine |
| Core HR | Reporting manager hierarchy | P0 | M | Employee | 5 | Y | Matrix orgs |
| Core HR | Bulk CSV import employees | P0 | M | Employee, Migration | 6 | Y | Continuous sync |
| Leave | Leave types & policies | P0 | L | Core HR | 12 | Y | Complex India variants |
| Leave | Accrual / opening balances | P0 | M | Policies | 8 | Y | Auto accrual jobs |
| Leave | Apply / cancel / withdraw | P0 | M | Workflow | 8 | Y | Team calendar UX++ |
| Leave | Balance ledger + HR adjust | P0 | M | Policies | 6 | Y | Encashment products |
| Leave | Holiday calendar | P0 | S | Org/Location | 3 | Y | Multi-calendar |
| Attendance | Manual mark (in/out or day status) | P0 | M | Core HR, Shifts optional | 8 | Y | Geofence/mobile |
| Attendance | CSV import + validation | P0 | M | Attendance | 8 | Y | Device connectors |
| Attendance | Month view employee/manager | P0 | M | Attendance | 6 | Y | Analytics |
| Attendance | Correction request + approve | P0 | M | Workflow | 8 | Y | Auto-suggest fixes |
| Attendance | Shift & holiday awareness (basic) | P0 | M | Core HR | 6 | Y | Complex rostering |
| Workflow | Definition (sequential approvers) | P0 | L | Identity | 12 | Y | Parallel/conditional |
| Workflow | Approval inbox approve/reject | P0 | M | WF def | 6 | Y | Slack/Teams |
| Workflow | Reminder notifications (pending approval) | P0 | S | Notifications | 3 | Y | Digests |
| Workflow | Escalation SLA / reassignment | P1 | M | Notifications | 6 | Stretch | SLA analytics |
| Documents | Upload/download metadata | P0 | M | Storage, RBAC | 8 | Y | e-sign |
| Documents | Categories + access control | P0 | M | RBAC | 5 | Y | Retention automation |
| Documents | Employee letter templates (light) | P0 | S | Docs | 4 | Y | Full template studio |
| ESS | Employee home + quick actions | P0 | M | Leave, Att, Docs | 8 | Y | Personalization |
| Manager | Team views + inbox | P0 | M | WF, Leave, Att | 8 | Y | Coaching insights |
| Notifications | In-app center | P0 | M | Events | 6 | Y | Preferences hub |
| Notifications | Email channel | P0 | M | SMTP | 5 | Y | Digests |
| Audit | Immutable audit events + query | P0 | M | All modules | 8 | Y | SIEM export |
| Reports | Headcount, joiners/exits | P0 | M | Core HR | 5 | Y | BI warehouse |
| Reports | Leave balances / utilization | P0 | M | Leave | 5 | Y | Predictive |
| Reports | Attendance exceptions | P0 | M | Attendance | 5 | Y | Workforce AI |
| Migration | greytHR CSV mapping + import | P0 | L | Core/Leave/Att | 12 | Y | Live connectors |
| Migration | Reconciliation reports | P0 | M | Migration | 5 | Y | Continuous audit |
| Platform | Docker Compose dev/stage | P0 | M | — | 5 | Y | K8s |
| Platform | OpenAPI generation | P0 | S | NestJS | 3 | Y | Partner APIs |
| Platform | CI (lint/test/build) | P0 | M | — | 5 | Y | CD to Azure |
| ATS | Light pipeline | P1 | L | Core HR | 15 | Stretch | Full ATS |
| Onboarding | Checklists | P1 | M | Docs, Core | 8 | Stretch | Journeys |
| Assets | Assignment | P1 | M | Core HR | 10 | Stretch | ITSM sync |
| Helpdesk | Simple HR tickets | P1 | M | WF | 10 | Stretch | Full service desk |
| Payroll | Full statutory engine | P2 | XL | — | 60+ | N | Specialized product |
| PMS / LMS / Expenses | Full modules | P2 | XL | — | 40+ each | N | Suite expansion |
| Mobile native / WhatsApp / AI / SCIM / Billing / Multi-country | — | P2 | XL | — | n/a | N | SaaS experiments |

**Estimate:** Sum of P0 midpoints exceeds raw capacity if naïvely added; plan uses parallelization, vertical slices, and contingency in [24-project-plan](24-project-plan-12-weeks.md). Treat table as prioritization aid, not a purchase order.

---

## 4. Major P0 feature specifications

Each subsection follows: Problem · User · Objective · User story · FRs · Business rules · AC · Edge cases · Errors · Permissions · Audit · Dependencies.

---

### 4.1 Identity & RBAC

**Problem:** Without trusted identity and role enforcement, HR data cannot safely move off greytHR.  
**User:** All personas; Admin configures roles.  
**Objective:** Authenticate users; authorize by role; audit authz-sensitive actions.

**User story:** As an employee, I securely sign in so I only see my ESS data; as HR, I access HR queues; as admin, I assign roles.

**Functional requirements (summary → SRS):** FR-IDN-* / FR-RBAC-* in [06](06-srs-functional.md).

**Business rules:**
- One active user account per employee email (**Assumption**).
- Disabled employment ⇒ login blocked.
- Role changes take effect on next request (or session refresh ≤15 min) (**Estimate**).

**Acceptance criteria:**
- [ ] Login with valid credentials issues session/token.
- [ ] Invalid credentials fail without user enumeration detail beyond generic message.
- [ ] Role-gated API returns 403 when unauthorized.
- [ ] Password reset flow works with time-limited token.
- [ ] Admin can assign roles Employee, Manager, HR Executive, HR Head, Finance Read, IT Admin, Security Admin (**Assumption** final role list).

**Edge cases:** Manager without direct reports; user with multiple roles; orphaned user (no employee link) for IT admin.  
**Errors:** Lockout after N failures (**Assumption:** N=5); SMTP down blocks reset email → show support message.  
**Permissions:** `identity.manage`, `rbac.assign` restricted to admins.  
**Audit:** login success/fail, logout, role assign/revoke, password reset request/complete.  
**Dependencies:** Employee record for most roles; email for reset.

---

### 4.2 Core HR — Organization & Employee

**Problem:** Org and employee master are the backbone for leave routing, attendance, and docs.  
**User:** HR Exec, HR Head; Managers/Employees read.  
**Objective:** Maintain accurate org structure and employee employment data with search and history hooks.

**User story:** As an HR executive, I create and update employees and org assignments so workflows route correctly.

**Business rules:**
- Employee code unique per tenant.
- Effective-dated department/manager changes preferred; MVP may store current + history table (**Assumption**: history v1).
- Exit sets status and triggers light offboarding checklist flag.

**Acceptance criteria:**
- [ ] CRUD departments, designations, locations.
- [ ] Create employee with mandatory fields (name, code, DOJ, dept, designation, manager, work email).
- [ ] Search by name/code/email/dept.
- [ ] Transfer/promote updates current assignment and records history event.
- [ ] Exit soft-disables login and retains record (no hard delete of employment history).

**Edge cases:** Manager transfer cascading; rehire (**Assumption**: new employment record linked to same person).  
**Errors:** Duplicate email/code; missing manager for roles that require one.  
**Permissions:** HR write; self read limited fields; manager read team.  
**Audit:** All create/update/status changes.  
**Dependencies:** Identity user provisioning on hire (**Assumption**: auto-create user).

---

### 4.3 Leave management

**Problem:** Leave disputes and slow approvals drive Excel workarounds.  
**User:** Employee, Manager, HR.  
**Objective:** Policy-aware apply/approve with visible balances and audited adjustments.

**User story:** As an employee, I apply leave and see balance/status; as a manager, I approve from inbox; as HR, I configure types and adjust balances with reason.

**Business rules:**
- Insufficient balance blocks submit unless HR override path.
- Overlap with existing approved leave rejected (same dates).
- Holidays / weekly offs interaction per policy (**Assumption**: document per leave type).
- Cancel allowed if not yet consumed / per policy window.

**Acceptance criteria:**
- [ ] HR configures leave types and policies (accrual or allotment model—choose in discovery).
- [ ] Opening balances importable via CSV.
- [ ] Employee submits multi-day request with reason.
- [ ] Workflow routes to manager (default) (**Assumption**).
- [ ] On approve, balance decrements via ledger entry.
- [ ] On reject/cancel, no net balance consumption.
- [ ] HR adjustment creates ledger entry + reason (mandatory).

**Edge cases:** Half-day; straddling holidays; manager on leave (escalation); negative balance prevention.  
**Errors:** Concurrent approve/withdraw race → optimistic version or status check.  
**Permissions:** Self apply; approver act; HR configure/adjust.  
**Audit:** Request lifecycle + balance ledger mutations.  
**Dependencies:** Workflow, Notifications, Holiday calendar, Core HR manager.

---

### 4.4 Attendance — mark, import, corrections

**Problem:** Mixed marking/import creates mismatches; email corrections are slow and unaudited.  
**User:** Employee (mark), HR (import), Manager/HR (approve corrections).  
**Objective:** Reliable daily attendance record with controlled corrections.

**User story:** As an employee, I mark attendance or request a correction; as HR, I import CSV and resolve errors; as a manager, I approve corrections.

**Business rules:**
- One logical attendance record per employee per date (status or punches—model decided in schema).
- Import is idempotent on (employee_code, date) with last-write policy documented.
- Correction cannot silently overwrite without approval when period not locked (**Assumption**).
- Period lock for payroll export blocks employee self-edit (**Assumption**).

**Acceptance criteria:**
- [ ] Employee can mark for today (and configurable past window).
- [ ] CSV import reports row-level errors without failing entire file optionally (partial success mode).
- [ ] Month view shows statuses for self and team (manager).
- [ ] Correction request captures from→to, reason, evidence note/file optional.
- [ ] Approved correction updates record + audit.

**Edge cases:** Duplicate import rows; unknown employee codes; timezone IST only (**Fact**: India-only).  
**Errors:** Import > size limit; invalid date formats.  
**Permissions:** Self mark; HR import; approvers on corrections.  
**Audit:** Mark, import batch meta, correction lifecycle.  
**Dependencies:** Workflow, Core HR, optional Shift.

---

### 4.5 Workflow engine v1

**Problem:** Email approvals lack transparency and audit.  
**User:** Approvers, HR (monitor), Admin (define templates).  
**Objective:** Sequential multi-step approvals with inbox and reminders (**escalation = P1 stretch**).

**User story:** As a manager, I see all pending approvals in one inbox and act with comment; as HR, I can monitor pending aging items.

**Business rules:**
- Definition bound by request type (LEAVE, ATT_CORRECTION, DOC_ACCESS optional).
- Single active instance per business request.
- Reject terminates instance; approve advances or completes.
- Reminder after T hours (**Assumption**: T configurable). Escalation reassignment is **P1**.

**Acceptance criteria (P0):**
- [ ] Create workflow definition with ordered steps (role or manager or user).
- [ ] Starting a request creates instance + tasks.
- [ ] Inbox lists my pending tasks with deep link.
- [ ] Approve/reject with mandatory comment on reject (**Assumption**).
- [ ] Reminder email/in-app for aging tasks.
- [ ] *(P1)* Escalation reassigns task and notifies.

**Edge cases:** Approver = requester (auto-skip or HR—**Assumption**); deleted user mid-flow.  
**Errors:** No definition for type → block submit with clear error.  
**Permissions:** Admin manage definitions; assignees act on tasks.  
**Audit:** Instance transitions, task actions, escalations.  
**Dependencies:** Identity, Notifications.

---

### 4.6 Documents

**Problem:** Uncontrolled document sprawl and weak access control.  
**User:** Employee, HR, Manager (limited).  
**Objective:** Store categorized employee/company documents with RBAC and audit.

**User story:** As an employee, I download my letters and upload KYC docs; as HR, I manage categories and access.

**Business rules:**
- Virus scanning **Assumption**: Stage A may be checksum + type allowlist only; note residual risk.
- Max file size and MIME allowlist enforced.
- Soft delete; hard delete only per retention job (future).

**Acceptance criteria:**
- [ ] Upload with category and employee association (or company library).
- [ ] Download authorized only.
- [ ] List filters by category/employee.
- [ ] HR can soft-delete with reason.

**Edge cases:** Re-upload versions (v1: replace or version flag—**Assumption**: single current + history optional).  
**Errors:** Oversize; disallowed type; storage failure.  
**Permissions:** Per category ACL.  
**Audit:** upload/download/delete/metadata change.  
**Dependencies:** Storage (local/MinIO), RBAC.

---

### 4.7 ESS + Manager portals

**Problem:** Users abandon HR tools with deep navigation.  
**User:** Employee, Manager.  
**Objective:** Low click-depth portals for daily actions and approvals.

**User story:** As an employee, from home I apply leave, see attendance, and open docs in ≤2 clicks; as a manager, I clear my inbox from one place.

**Business rules:**
- Home widgets respect RBAC.
- Empty states teach next action.

**Acceptance criteria:**
- [ ] ESS home: balances, pending requests, notifications, quick actions.
- [ ] Manager home: inbox count, team on leave, attendance exceptions.
- [ ] Mobile-responsive layouts usable on common phone widths.
- [ ] Consistent status chips (Pending/Approved/Rejected).

**Edge cases:** User is both employee and manager.  
**Errors:** Partial module outage → degrade widgets with error callouts.  
**Permissions:** Portal shells only show authorized modules.  
**Audit:** N/A beyond underlying modules.  
**Dependencies:** Leave, Attendance, WF, Docs, Notifications.  
**UX reference:** [09-ux-ui-specification](09-ux-ui-specification.md).

---

### 4.8 Notifications (email + in-app)

**Problem:** Users miss approval and status changes.  
**User:** All.  
**Objective:** Reliable in-app feed + email for critical events.

**User story:** As an approver, I get notified of new tasks and escalations; as an employee, I learn of approve/reject.

**Business rules:**
- Notification created on domain events (leave submitted, task assigned, etc.).
- Email failures retry with backoff; in-app still written (**Assumption**).
- User can mark read / mark all read.

**Acceptance criteria:**
- [ ] In-app list with unread badge.
- [ ] Email sent for: task assigned, request decided, escalation (**Assumption** final matrix).
- [ ] Deep link to relevant screen.

**Edge cases:** User email bouncing → flag in admin (**Estimate**: basic log).  
**Errors:** SMTP misconfig surfaces in health check.  
**Permissions:** Self only.  
**Audit:** Optional send log (P0 minimal).  
**Dependencies:** SMTP, event bus/in-process events.

---

### 4.9 Audit

**Problem:** Compliance and dispute resolution need “who changed what.”  
**User:** Security Admin, HR Head, IT.  
**Objective:** Append-only audit for sensitive actions with query UI/export.

**User story:** As a security admin, I filter audit by actor, entity, date and export results.

**Business rules:**
- Audit records immutable via app APIs.
- Store actor, action, entity type/id, before/after summary or diff pointer, IP/user-agent if available, timestamp.

**Acceptance criteria:**
- [ ] Sensitive mutations create audit rows.
- [ ] Query by date range + actor + entity.
- [ ] CSV export for a filtered set (size-capped).

**Edge cases:** System/batch actor for imports.  
**Errors:** Export too large → ask narrower filter.  
**Permissions:** `audit.read`.  
**Audit:** Meta — access to audit log itself logged (**Assumption**).  
**Dependencies:** Cross-cutting instrumentation.

---

### 4.10 Operational reports

**Problem:** Leadership/HR rely on manual extracts.  
**User:** HR, Leadership, Finance (subset).  
**Objective:** First-wave operational reports, not a BI platform.

**User story:** As HR Head, I run headcount and leave utilization reports for a date range and export CSV.

**Reports (P0 list):**
1. Headcount by dept/location/status  
2. Joiners & exits in period  
3. Leave balances by type  
4. Leave requests by status  
5. Attendance exceptions (absent/missing/missing punch)  
6. Open approvals aging  

**Acceptance criteria:**
- [ ] Each report runs with filters and CSV export.
- [ ] Authorization enforced (org-wide vs dept).
- [ ] Performance target: p95 < 5s on ~500 employees for standard filters (**Estimate** / **NFR**).

**Edge cases:** Empty org; soft-deleted employees excluded by default.  
**Errors:** Invalid date range.  
**Permissions:** Report-specific claims.  
**Audit:** Report export events for sensitive reports (**Assumption**).  
**Dependencies:** Underlying data quality.

---

### 4.11 greytHR CSV migration

**Problem:** Cutover fails without mapping, dry-run, and reconciliation.  
**User:** HR Head, HR Exec, Engineering.  
**Objective:** Import agreed entities with reconciliation report and rerunnable dry-run.

**User story:** As HR, I upload greytHR exports, review errors, and accept a reconciliation summary before go-live.

**Business rules:**
- Dry-run does not commit (or commits to staging schema)—pick one in ADR.
- Mapping documented per file type.
- Idempotent natural keys (employee code, etc.).

**Acceptance criteria:**
- [ ] Documented templates for employee, leave balance, attendance (as available).
- [ ] Validation report with row errors.
- [ ] Reconciliation: counts + sample field diffs.
- [ ] At least one successful dry-run on production-like copy before pilot.

**Edge cases:** Partial historical attendance (**Assumption**: last N months only).  
**Errors:** Unknown columns; encoding issues.  
**Permissions:** HR Head + IT.  
**Audit:** Migration batch records.  
**Dependencies:** greytHR export discovery (**Assumption** A-01).

---

### 4.12 Platform — Docker, OpenAPI, CI

**Problem:** Without packaged run & API contracts, delivery and future Azure move stall.  
**User:** Engineering, IT.  
**Objective:** Reproducible local/stage stack; published OpenAPI; CI quality gates.

**Acceptance criteria:**
- [ ] `docker compose up` brings API, web, Postgres, (optional) mail/storage.
- [ ] OpenAPI published for `/api/v1`.
- [ ] CI runs lint, unit tests, build on main/PR.

**Dependencies:** Repo standards in engineering governance docs.

---

## 5. P1 stretch (not committed)

| Feature | Entry criteria |
|---------|----------------|
| Light ATS | P0 UAT green + ≥10% capacity buffer |
| Onboarding checklists | Same |
| Asset assignment | Same |
| Simple HR helpdesk | Same |

If any P1 starts, it must not jeopardize migration/security hardening in weeks 11–12.

---

## 6. P2 deferred (explicit)

Full payroll engine; performance; LMS; expenses; advanced BI; native mobile; WhatsApp; multi-country; billing; SCIM; AI agents; biometric farms; full alumni CRM.

---

## 7. Risks specific to PRD

| Risk | Mitigation | Label |
|------|------------|-------|
| Leave policy complexity explosion | Freeze policy catalog week 2 | **Estimate** |
| greytHR export gaps | Early discovery; narrow historical window | **Assumption** |
| Workflow over-engineering | Sequential-only v1 | **Fact** (scope) |
| UX click-depth | Enforce UX spec reviews | **Assumption** |

---

## 8. Traceability

| PRD section | SRS | Stories | Tests | Release |
|-------------|-----|---------|-------|---------|
| §4.1 Identity | FR-IDN, FR-RBAC | US-IDN-* | TC-IDN-* | R1 MVP |
| §4.2 Core HR | FR-CORE-* | US-CORE-* | TC-CORE-* | R1 MVP |
| §4.3 Leave | FR-LEAVE-* | US-LEAVE-* | TC-LEAVE-* | R1 MVP |
| §4.4 Attendance | FR-ATT-* | US-ATT-* | TC-ATT-* | R1 MVP |
| §4.5 Workflow | FR-WF-* | US-WF-* | TC-WF-* | R1 MVP |
| §4.6 Documents | FR-DOC-* | US-DOC-* | TC-DOC-* | R1 MVP |
| §4.7 ESS/Manager | FR-ESS-* | US-ESS-* | TC-ESS-* | R1 MVP |
| §4.8 Notifications | FR-NOTIF-* | US-NOTIF-* | TC-NOTIF-* | R1 MVP |
| §4.9 Audit | FR-AUD-* | US-AUD-* | TC-AUD-* | R1 MVP |
| §4.10 Reports | FR-RPT-* | US-RPT-* | TC-RPT-* | R1 MVP |
| §4.11 Migration | FR-MIG-* | US-MIG-* | TC-MIG-* | R1 MVP |
| §4.12 Platform | NFR-OPS-* | US-OPS-* | TC-OPS-* | R1 MVP |

---

*PRD freeze required before Sprint 3 feature coding. Changes go through change control ([30-engineering-governance](30-engineering-governance.md)).*
