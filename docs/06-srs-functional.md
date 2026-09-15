# 06 — Software Requirements Specification (Functional & Non-Functional)

**Product:** PeopleOS MVP  
**Related:** [05-product-requirements-mvp](05-product-requirements-mvp.md) · [07-user-stories](07-user-stories.md) · [16-testing-strategy](16-testing-strategy.md)  
**ID conventions:** `FR-<AREA>-###` · `NFR-<AREA>-###`  
**Traceability columns:** Story · Test · Release

---

## Evidence labels

**Fact** | **Assumption** | **Estimate** | **Metric-to-measure**

---

## 1. SRS introduction

| Item | Detail |
|------|--------|
| Purpose | Specify testable functional and non-functional requirements for P0 MVP |
| Scope | Identity/RBAC, Core HR, Leave, Attendance, Workflow, Documents, ESS/Manager, Notifications, Audit, Reports, Migration support, Platform NFRs |
| Out of scope | P2 modules listed in [05](05-product-requirements-mvp.md) |
| Users | Roles in [04](04-business-requirements.md) |
| References | OpenAPI `/api/v1`; Docker Compose; CI pipeline |

### 1.1 Requirement template

Every FR below includes: **ID, Title, Requirement, Description, Role, Priority, Preconditions, Main flow, Alternate flow, Error handling, Security, Acceptance criteria**, plus **Story / Test / Release** traceability.

Priority: **Must** = P0 · **Should** = P1 stretch · **Could** = backlog.

---

## 2. Functional requirements — Identity (`FR-IDN`)

### FR-IDN-001 — User login

| Field | Content |
|-------|---------|
| **Title** | Authenticate with email and password |
| **Requirement** | System shall authenticate registered users with email + password and issue a session/access token. |
| **Description** | Primary login for ESS/HR/Admin portals. India IST timestamps on audit. |
| **Role** | All authenticated personas |
| **Priority** | Must |
| **Preconditions** | User exists; status Active; password set |
| **Main flow** | 1. User submits credentials 2. System validates 3. Issues token/session 4. Redirects to role home |
| **Alternate flow** | Already authenticated → redirect home |
| **Error handling** | Invalid credentials → generic error; locked account → lock message |
| **Security** | HTTPS; hashed passwords; rate limit; no password in logs |
| **AC** | Valid login succeeds; invalid fails; lock after N failures (**Assumption** N=5) |
| **Story** | US-IDN-01 | **Test** | TC-IDN-01 | **Release** | R1 |

### FR-IDN-002 — Logout

| Field | Content |
|-------|---------|
| **Title** | End session |
| **Requirement** | System shall invalidate server-side session / refresh token on logout. |
| **Role** | Authenticated user |
| **Priority** | Must |
| **Preconditions** | Valid session |
| **Main flow** | User selects logout → session invalidated → login screen |
| **Alternate** | Token already expired → treat as logged out |
| **Error** | Idempotent success |
| **Security** | CSRF protection on cookie sessions if used |
| **AC** | Subsequent API calls with old token fail |
| **Story** | US-IDN-02 | **Test** | TC-IDN-02 | **Release** | R1 |

### FR-IDN-003 — Password reset

| Field | Content |
|-------|---------|
| **Title** | Reset password via email token |
| **Requirement** | System shall allow users to reset passwords using a time-limited email token. |
| **Role** | User (self) |
| **Priority** | Must |
| **Preconditions** | Account with verified email |
| **Main flow** | Request reset → email link → set new password → invalidate token |
| **Alternate** | Token expired → request new |
| **Error** | SMTP failure → support message; in-app admin reset path for HR/IT (**Assumption**) |
| **Security** | Single-use token; expiry ≤1h (**Estimate**); generic response on unknown email |
| **AC** | Valid token resets password; reused token fails |
| **Story** | US-IDN-03 | **Test** | TC-IDN-03 | **Release** | R1 |

### FR-IDN-004 — Provision user on hire

| Field | Content |
|-------|---------|
| **Title** | Create login when employee hired |
| **Requirement** | On employee create with work email, system shall create linked user in Disabled/Invite or Active per policy. |
| **Role** | System / HR |
| **Priority** | Must |
| **Preconditions** | Unique email; HR authorized |
| **Main flow** | Hire → create user → send invite/reset link |
| **Alternate** | User already exists → link employee (**Assumption**) |
| **Error** | Duplicate email → block hire |
| **Security** | Temporary password not emailed in clear if invite link used |
| **AC** | Employee record has `user_id`; invite delivered when SMTP ok |
| **Story** | US-CORE-03 | **Test** | TC-IDN-04 | **Release** | R1 |

---

## 3. Functional requirements — RBAC (`FR-RBAC`)

### FR-RBAC-001 — Role assignment

| Field | Content |
|-------|---------|
| **Title** | Assign roles to users |
| **Requirement** | Admin shall assign one or more roles from the approved role catalog to a user. |
| **Role** | IT Admin / Security Admin |
| **Priority** | Must |
| **Preconditions** | Admin authenticated with `rbac.assign` |
| **Main flow** | Select user → assign roles → save → audit |
| **Alternate** | Remove role |
| **Error** | Cannot remove last Security Admin (**Assumption**) |
| **Security** | Least privilege; dual control optional later |
| **AC** | Effective permissions match role matrix |
| **Story** | US-RBAC-01 | **Test** | TC-RBAC-01 | **Release** | R1 |

### FR-RBAC-002 — Permission enforcement

| Field | Content |
|-------|---------|
| **Title** | Enforce permissions on API and UI |
| **Requirement** | Every protected API shall authorize by permission; UI shall hide unauthorized actions. |
| **Role** | System |
| **Priority** | Must |
| **Preconditions** | Authenticated request |
| **Main flow** | Check permission → allow |
| **Alternate** | UI hide vs disable (prefer hide destructive) |
| **Error** | 403 with stable error code |
| **Security** | UI hide is not sufficient; API must enforce |
| **AC** | Automated tests prove deny for cross-role access |
| **Story** | US-RBAC-02 | **Test** | TC-RBAC-02 | **Release** | R1 |

**Role catalog (MVP Assumption):** `EMPLOYEE`, `MANAGER`, `HR_EXEC`, `HR_HEAD`, `FINANCE_READ`, `IT_ADMIN`, `SECURITY_ADMIN`, `LEADERSHIP_READ`.

---

## 4. Functional requirements — Core HR (`FR-CORE`)

### FR-CORE-001 — Maintain organization structure

| Field | Content |
|-------|---------|
| **Title** | Departments, designations, locations |
| **Requirement** | HR shall create/update/deactivate departments, designations, and locations. |
| **Role** | HR_EXEC, HR_HEAD |
| **Priority** | Must |
| **Preconditions** | Authenticated HR |
| **Main flow** | Open admin org → create entity → save |
| **Alternate** | Deactivate (soft) when unused |
| **Error** | Delete blocked if employees assigned → require deactivate |
| **Security** | HR-only write |
| **AC** | Entities listable/filterable; soft-deleted hidden by default |
| **Story** | US-CORE-01 | **Test** | TC-CORE-01 | **Release** | R1 |

### FR-CORE-002 — Create employee

| Field | Content |
|-------|---------|
| **Title** | Create employee master record |
| **Requirement** | HR shall create an employee with mandatory identity and assignment fields. |
| **Description** | Mandatory (**Assumption**): employee_code, first/last name, work_email, date_of_joining, department_id, designation_id, location_id, manager_employee_id (nullable only for CEO-level), status=Active. |
| **Role** | HR_EXEC, HR_HEAD |
| **Priority** | Must |
| **Preconditions** | Org entities exist |
| **Main flow** | Enter fields → validate → create employee → provision user → audit |
| **Alternate** | Save draft (**Could** — not MVP) |
| **Error** | Duplicate code/email; invalid DOJ |
| **Security** | Field-level: PAN/Aadhaar masked in UI (**Assumption** if stored) |
| **AC** | Employee searchable; appears in headcount report |
| **Story** | US-CORE-02 | **Test** | TC-CORE-02 | **Release** | R1 |

### FR-CORE-003 — Update employee & employment events

| Field | Content |
|-------|---------|
| **Title** | Transfer, promote, update profile |
| **Requirement** | HR shall update profile fields and record transfer/promotion/exit events. |
| **Role** | HR_EXEC, HR_HEAD |
| **Priority** | Must |
| **Preconditions** | Employee exists |
| **Main flow** | Edit → confirm event type → save history → audit |
| **Alternate** | Employee self-updates limited fields (phone, emergency contact) |
| **Error** | Invalid manager cycle (A manages B manages A) rejected |
| **Security** | Self cannot change dept/designation/salary fields |
| **AC** | History shows prior dept/manager; exit disables login |
| **Story** | US-CORE-04 | **Test** | TC-CORE-03 | **Release** | R1 |

### FR-CORE-004 — Employee search

| Field | Content |
|-------|---------|
| **Title** | Search employees |
| **Requirement** | Authorized users shall search by name, code, email, department, status. |
| **Role** | HR_*; MANAGER (team); LEADERSHIP_READ (org) |
| **Priority** | Must |
| **Preconditions** | AuthZ scope |
| **Main flow** | Enter query → paged results |
| **Alternate** | Empty query → paged directory within scope |
| **Error** | Unauthorized scope → empty/403 |
| **Security** | Scope filter mandatory server-side |
| **AC** | p95 search < 2s at 500 employees (**Estimate**/NFR) |
| **Story** | US-CORE-05 | **Test** | TC-CORE-04 | **Release** | R1 |

### FR-CORE-005 — Bulk employee CSV import

| Field | Content |
|-------|---------|
| **Title** | Import employees from CSV |
| **Requirement** | HR shall upload CSV to create/update employees with row-level validation report. |
| **Role** | HR_HEAD, HR_EXEC |
| **Priority** | Must |
| **Preconditions** | Template known; dry-run option |
| **Main flow** | Upload → validate → confirm → commit → summary |
| **Alternate** | Dry-run only |
| **Error** | Partial success mode with error CSV |
| **Security** | Size limit; virus allowlist |
| **AC** | Reconciliation counts match; audit batch id |
| **Story** | US-MIG-02 | **Test** | TC-CORE-05 | **Release** | R1 |

---

## 5. Functional requirements — Leave (`FR-LEAVE`)

### FR-LEAVE-001 — Configure leave types & policies

| Field | Content |
|-------|---------|
| **Title** | Leave policy configuration |
| **Requirement** | HR Head shall define leave types and policy parameters (accrual/allotment, max balance, gender rules if any, sandwich rule flag). |
| **Role** | HR_HEAD |
| **Priority** | Must |
| **Preconditions** | AuthZ |
| **Main flow** | Create type → set policy → activate |
| **Alternate** | Deactivate type (no new requests) |
| **Error** | Invalid numeric params |
| **Security** | HR_HEAD only for activate |
| **AC** | Policies versioned or effective-dated (**Assumption**: effective_from) |
| **Story** | US-LEAVE-01 | **Test** | TC-LEAVE-01 | **Release** | R1 |

### FR-LEAVE-002 — Leave balances

| Field | Content |
|-------|---------|
| **Title** | View and maintain balances |
| **Requirement** | System shall maintain per-employee per-type balances via ledger; employees view own; HR adjusts with reason. |
| **Role** | EMPLOYEE (read); HR_* (adjust) |
| **Priority** | Must |
| **Preconditions** | Employee + leave type |
| **Main flow** | View balance → (HR) adjust → ledger entry |
| **Alternate** | Opening balance import |
| **Error** | Adjust without reason rejected |
| **Security** | Adjust permission gated |
| **AC** | Ledger sum equals displayed balance |
| **Story** | US-LEAVE-02 | **Test** | TC-LEAVE-02 | **Release** | R1 |

### FR-LEAVE-003 — Apply leave

| Field | Content |
|-------|---------|
| **Title** | Submit leave request |
| **Requirement** | Employee shall submit leave for date range/half-day with type and reason; system validates balance & overlap. |
| **Role** | EMPLOYEE |
| **Priority** | Must |
| **Preconditions** | Active employee; policy active |
| **Main flow** | Form → validate → create request → start workflow → notify approver |
| **Alternate** | Withdraw while pending |
| **Error** | Insufficient balance; overlap; no workflow definition |
| **Security** | Self-only submit |
| **AC** | Status Pending; task created for approver |
| **Story** | US-LEAVE-03 | **Test** | TC-LEAVE-03 | **Release** | R1 |

### FR-LEAVE-004 — Decide leave

| Field | Content |
|-------|---------|
| **Title** | Approve or reject leave |
| **Requirement** | Approver shall approve/reject pending leave; approve posts ledger consumption. |
| **Role** | MANAGER / designated |
| **Priority** | Must |
| **Preconditions** | Open workflow task |
| **Main flow** | Open task → approve/reject (+ comment on reject) → complete WF → notify employee → update balance if approved |
| **Alternate** | Escalate per FR-WF-004 (P1 stretch) |
| **Error** | Stale status → refresh error |
| **Security** | Only assignee or escalated actor |
| **AC** | Approved reduces balance; rejected does not |
| **Story** | US-LEAVE-04 | **Test** | TC-LEAVE-04 | **Release** | R1 |

### FR-LEAVE-005 — Holiday calendar

| Field | Content |
|-------|---------|
| **Title** | Maintain holidays |
| **Requirement** | HR shall maintain holiday lists by location/company and expose to leave/attendance calculations. |
| **Role** | HR_* |
| **Priority** | Must |
| **Preconditions** | Locations exist |
| **Main flow** | Add holiday dates → save |
| **Alternate** | Import holidays CSV |
| **Error** | Duplicate date |
| **Security** | HR write |
| **AC** | Holidays visible on ESS calendar |
| **Story** | US-LEAVE-05 | **Test** | TC-LEAVE-05 | **Release** | R1 |

---

## 6. Functional requirements — Attendance (`FR-ATT`)

### FR-ATT-001 — Mark attendance

| Field | Content |
|-------|---------|
| **Title** | Employee marks attendance |
| **Requirement** | Employee shall mark daily attendance within allowed window (present/WFH/etc. per config). |
| **Role** | EMPLOYEE |
| **Priority** | Must |
| **Preconditions** | Active; marking enabled |
| **Main flow** | Open today → mark → save → audit |
| **Alternate** | Mark yesterday if window allows |
| **Error** | Outside window; period locked |
| **Security** | Self-only |
| **AC** | Record visible in month view |
| **Story** | US-ATT-01 | **Test** | TC-ATT-01 | **Release** | R1 |

### FR-ATT-002 — Import attendance CSV

| Field | Content |
|-------|---------|
| **Title** | Bulk import attendance |
| **Requirement** | HR shall import attendance CSV with validation and batch summary. |
| **Role** | HR_EXEC, HR_HEAD |
| **Priority** | Must |
| **Preconditions** | Template; employees exist |
| **Main flow** | Upload → validate → commit → show errors |
| **Alternate** | Dry-run |
| **Error** | Unknown employee_code rows skipped/errored |
| **Security** | HR only; size limits |
| **AC** | Idempotent upsert on (employee, date) |
| **Story** | US-ATT-02 | **Test** | TC-ATT-02 | **Release** | R1 |

### FR-ATT-003 — Attendance month views

| Field | Content |
|-------|---------|
| **Title** | Self and team month views |
| **Requirement** | Employee views own month; manager views team month with exception highlights. |
| **Role** | EMPLOYEE, MANAGER |
| **Priority** | Must |
| **Preconditions** | Data exists |
| **Main flow** | Select month → render grid |
| **Alternate** | Filter exceptions only |
| **Error** | Unauthorized team member hidden |
| **Security** | Team scope server-side |
| **AC** | Exceptions match report definition |
| **Story** | US-ATT-03 | **Test** | TC-ATT-03 | **Release** | R1 |

### FR-ATT-004 — Attendance correction

| Field | Content |
|-------|---------|
| **Title** | Request and approve correction |
| **Requirement** | Employee shall request correction; approver decides via workflow; on approve, attendance updates. |
| **Role** | EMPLOYEE, MANAGER/HR |
| **Priority** | Must |
| **Preconditions** | Source record exists or missing day |
| **Main flow** | Request (from→to, reason) → WF → decide → apply |
| **Alternate** | HR direct correct with reason (break-glass) (**Assumption**) |
| **Error** | Locked period |
| **Security** | Evidence optional file via Docs |
| **AC** | Audit shows before/after |
| **Story** | US-ATT-04 | **Test** | TC-ATT-04 | **Release** | R1 |

### FR-ATT-005 — Basic shift awareness

| Field | Content |
|-------|---------|
| **Title** | Assign shift (basic) |
| **Requirement** | HR shall assign a named shift to employee; attendance interprets expected time if punches used. |
| **Role** | HR_* |
| **Priority** | Must (basic) |
| **Preconditions** | Shift master |
| **Main flow** | Create shift → assign employee |
| **Alternate** | Default general shift |
| **Error** | Overlapping assignments |
| **Security** | HR write |
| **AC** | Shift shown on profile |
| **Story** | US-ATT-05 | **Test** | TC-ATT-05 | **Release** | R1 |

---

## 7. Functional requirements — Workflow (`FR-WF`)

### FR-WF-001 — Define workflow

| Field | Content |
|-------|---------|
| **Title** | Sequential workflow definition |
| **Requirement** | Admin/HR Head shall define sequential approval steps per request type. |
| **Role** | HR_HEAD, IT_ADMIN |
| **Priority** | Must |
| **Preconditions** | Roles/users exist |
| **Main flow** | Create definition → add steps → activate |
| **Alternate** | Clone definition |
| **Error** | Empty steps |
| **Security** | Change audited |
| **AC** | Only one active definition per type+org scope (**Assumption**) |
| **Story** | US-WF-01 | **Test** | TC-WF-01 | **Release** | R1 |

### FR-WF-002 — Approval inbox

| Field | Content |
|-------|---------|
| **Title** | Act on approval tasks |
| **Requirement** | Approvers shall list pending tasks and approve/reject with comments. |
| **Role** | Assignees |
| **Priority** | Must |
| **Preconditions** | Open tasks |
| **Main flow** | Inbox → open → decide → next step or complete |
| **Alternate** | Filter by type |
| **Error** | Concurrent decision → one wins, other informed |
| **Security** | Assignee-only |
| **AC** | Deep link from notification works |
| **Story** | US-WF-02 | **Test** | TC-WF-02 | **Release** | R1 |

### FR-WF-003 — Pending approval reminders

| Field | Content |
|-------|---------|
| **Title** | Remind assignees of pending tasks |
| **Requirement** | System shall send reminder notifications for pending approval tasks after a configured threshold. |
| **Role** | System job |
| **Priority** | Must (P0) |
| **Preconditions** | Notifications available; task still pending |
| **Main flow** | Scheduler finds aging tasks → notify assignee |
| **Alternate** | Preference disables email → in-app only |
| **Error** | Job failure retries; alert IT |
| **Security** | Job uses service principal |
| **AC** | Reminder creates notification; no duplicate spam within cooldown |
| **Story** | US-WF-03 | **Test** | TC-WF-03 | **Release** | R1 |

### FR-WF-004 — Escalation SLA (stretch)

| Field | Content |
|-------|---------|
| **Title** | Escalate overdue tasks |
| **Requirement** | System shall reassign overdue tasks to backup approver or HR after SLA threshold. |
| **Role** | System job |
| **Priority** | Should (P1 stretch — not committed in 12-week freeze) |
| **Preconditions** | Reminder path working; backup configured |
| **Main flow** | Scheduler finds overdue → reassign → notify |
| **Alternate** | No backup → escalate to HR queue |
| **Error** | Job failure retries; alert IT |
| **Security** | Job uses service principal |
| **AC** | Escalation creates audit + notification |
| **Story** | US-WF-04 | **Test** | TC-WF-04 | **Release** | R1+ (stretch) |

---

## 8. Functional requirements — Documents (`FR-DOC`)

### FR-DOC-001 — Upload document

| Field | Content |
|-------|---------|
| **Title** | Upload employee/company document |
| **Requirement** | Authorized users shall upload files with category and metadata. |
| **Role** | HR_*; EMPLOYEE (own KYC categories) |
| **Priority** | Must |
| **Preconditions** | Category exists; storage available |
| **Main flow** | Select file → category → upload → metadata saved |
| **Alternate** | Replace existing current version |
| **Error** | Type/size rejected |
| **Security** | Allowlist MIME; authZ; encrypted at rest **Assumption** Stage B |
| **AC** | File downloadable by authorized roles only |
| **Story** | US-DOC-01 | **Test** | TC-DOC-01 | **Release** | R1 |

### FR-DOC-002 — Download & access control

| Field | Content |
|-------|---------|
| **Title** | Controlled download |
| **Requirement** | System shall authorize downloads per category ACL and log access. |
| **Role** | Per ACL |
| **Priority** | Must |
| **Preconditions** | Document exists |
| **Main flow** | Request download → authZ → stream → audit |
| **Alternate** | Denied → 403 |
| **Error** | Missing blob → 410/404 |
| **Security** | No direct public bucket URLs without signed short TTL (**Assumption**) |
| **AC** | Unauthorized user cannot download |
| **Story** | US-DOC-02 | **Test** | TC-DOC-02 | **Release** | R1 |

### FR-DOC-003 — Categories & soft delete

| Field | Content |
|-------|---------|
| **Title** | Manage categories and soft delete |
| **Requirement** | HR shall manage categories; soft-delete documents with reason. |
| **Role** | HR_* |
| **Priority** | Must |
| **Main flow** | Configure category ACL → soft delete doc |
| **Alternate** | Restore soft-deleted (**Should**) |
| **Error** | Delete without reason rejected |
| **Security** | Soft delete retains audit |
| **AC** | Soft-deleted hidden from ESS |
| **Story** | US-DOC-03 | **Test** | TC-DOC-03 | **Release** | R1 |

---

## 9. Functional requirements — ESS / Manager (`FR-ESS`)

### FR-ESS-001 — Employee home

| Field | Content |
|-------|---------|
| **Title** | ESS home dashboard |
| **Requirement** | Employee shall see quick actions, leave balances summary, pending requests, and unread notifications. |
| **Role** | EMPLOYEE |
| **Priority** | Must |
| **Preconditions** | Login |
| **Main flow** | Open `/ess` → widgets load |
| **Alternate** | Widget error isolated |
| **Error** | Partial failure banners |
| **Security** | Self data only |
| **AC** | Primary actions reachable in ≤2 clicks ([09](09-ux-ui-specification.md)) |
| **Story** | US-ESS-01 | **Test** | TC-ESS-01 | **Release** | R1 |

### FR-ESS-002 — Manager home & team

| Field | Content |
|-------|---------|
| **Title** | Manager portal home |
| **Requirement** | Manager shall see approvals inbox summary, team on leave, and attendance exceptions. |
| **Role** | MANAGER |
| **Priority** | Must |
| **Preconditions** | Has direct reports or tasks |
| **Main flow** | Open `/manager` → widgets |
| **Alternate** | No reports → empty state with explanation |
| **Error** | Scope leak tests must fail closed |
| **Security** | Team scope |
| **AC** | Inbox count matches pending tasks |
| **Story** | US-ESS-02 | **Test** | TC-ESS-02 | **Release** | R1 |

---

## 10. Functional requirements — Notifications (`FR-NOTIF`)

### FR-NOTIF-001 — In-app notifications

| Field | Content |
|-------|---------|
| **Title** | In-app notification center |
| **Requirement** | System shall create in-app notifications for configured domain events and allow mark-read. |
| **Role** | All users |
| **Priority** | Must |
| **Main flow** | Event → notify → user opens center → mark read |
| **Alternate** | Mark all read |
| **Error** | Delivery write failure retries |
| **Security** | Self-only |
| **AC** | Unread badge accurate |
| **Story** | US-NOTIF-01 | **Test** | TC-NOTIF-01 | **Release** | R1 |

### FR-NOTIF-002 — Email notifications

| Field | Content |
|-------|---------|
| **Title** | Email channel |
| **Requirement** | System shall email users for task assignment, decision, and escalation events. |
| **Role** | System |
| **Priority** | Must |
| **Preconditions** | SMTP configured |
| **Main flow** | Event → render template → send → log |
| **Alternate** | SMTP down → in-app only + ops alert |
| **Error** | Bounce logged |
| **Security** | No sensitive secrets in email body |
| **AC** | Email contains deep link |
| **Story** | US-NOTIF-02 | **Test** | TC-NOTIF-02 | **Release** | R1 |

---

## 11. Functional requirements — Audit (`FR-AUD`)

### FR-AUD-001 — Record audit events

| Field | Content |
|-------|---------|
| **Title** | Append-only audit |
| **Requirement** | System shall record audit events for sensitive create/update/delete and security actions. |
| **Role** | System |
| **Priority** | Must |
| **Main flow** | Domain mutation → audit write same transaction or reliable outbox (**Assumption**: same TX preferred) |
| **Alternate** | Batch actor for imports |
| **Error** | Audit failure fails the mutation (**Assumption**: strict mode for sensitive) |
| **Security** | No update/delete APIs on audit rows |
| **AC** | Spot-check leave approve creates audit |
| **Story** | US-AUD-01 | **Test** | TC-AUD-01 | **Release** | R1 |

### FR-AUD-002 — Query and export audit

| Field | Content |
|-------|---------|
| **Title** | Audit search/export |
| **Requirement** | Security Admin shall filter audit by date, actor, entity and export CSV within size limits. |
| **Role** | SECURITY_ADMIN, HR_HEAD (limited) |
| **Priority** | Must |
| **Main flow** | Filter → view → export |
| **Error** | Oversize → narrow filter |
| **Security** | Access to audit is itself audited |
| **AC** | Export matches on-screen filter |
| **Story** | US-AUD-02 | **Test** | TC-AUD-02 | **Release** | R1 |

---

## 12. Functional requirements — Reports (`FR-RPT`)

### FR-RPT-001 — Operational report set

| Field | Content |
|-------|---------|
| **Title** | Run operational reports |
| **Requirement** | Authorized users shall run P0 reports (headcount, joiners/exits, leave balances/requests, attendance exceptions, approvals aging) with CSV export. |
| **Role** | HR_*, LEADERSHIP_READ, FINANCE_READ (subset) |
| **Priority** | Must |
| **Preconditions** | Data present |
| **Main flow** | Select report → filters → run → export |
| **Alternate** | Save filter preset (**Could**) |
| **Error** | Invalid dates |
| **Security** | Scope by role |
| **AC** | Each report listed in [05 §4.10](05-product-requirements-mvp.md) available |
| **Story** | US-RPT-01 | **Test** | TC-RPT-01 | **Release** | R1 |

---

## 13. Functional requirements — Migration (`FR-MIG`)

### FR-MIG-001 — greytHR CSV migration toolkit

| Field | Content |
|-------|---------|
| **Title** | Migrate from greytHR exports |
| **Requirement** | System shall support documented CSV templates, dry-run validation, commit, and reconciliation summary for agreed entities. |
| **Role** | HR_HEAD, IT_ADMIN |
| **Priority** | Must |
| **Preconditions** | Export files available |
| **Main flow** | Upload → dry-run → review → commit → reconcile |
| **Alternate** | Entity-by-entity migration order |
| **Error** | Blocking errors halt commit |
| **Security** | Restricted permission; files retained per policy |
| **AC** | Dry-run on prod-like data succeeds before pilot |
| **Story** | US-MIG-01 | **Test** | TC-MIG-01 | **Release** | R1 |

---

## 14. Non-functional requirements

### NFR-SEC-001 — Transport security

| Field | Content |
|-------|---------|
| **Requirement** | All non-local production endpoints shall use TLS. |
| **Priority** | Must | **AC** | No cleartext prod credentials | **Story** | US-OPS-01 | **Test** | TC-SEC-01 | **Release** | R1 |

### NFR-SEC-002 — Password storage

| Field | Content |
|-------|---------|
| **Requirement** | Passwords stored with modern one-way KDF (e.g., Argon2id/bcrypt). |
| **Priority** | Must | **AC** | No plaintext/reversible password storage | **Test** | TC-SEC-02 | **Release** | R1 |

### NFR-SEC-003 — RBAC deny-by-default

| Field | Content |
|-------|---------|
| **Requirement** | APIs deny unless permission granted. |
| **Priority** | Must | **Test** | TC-RBAC-02 | **Release** | R1 |

### NFR-SEC-004 — PII minimization

| Field | Content |
|-------|---------|
| **Requirement** | Collect only fields needed for MVP; mask sensitive IDs in UI. |
| **Priority** | Must | **Label** | **Assumption** legal review | **Release** | R1 |

### NFR-PERF-001 — API latency

| Field | Content |
|-------|---------|
| **Requirement** | p95 interactive API < 500ms on staging dataset ~500 employees for simple GETs (**Estimate** target). |
| **Priority** | Must | **Test** | TC-PERF-01 | **Release** | R1 |

### NFR-PERF-002 — Report latency

| Field | Content |
|-------|---------|
| **Requirement** | p95 standard ops report < 5s under same dataset (**Estimate**). |
| **Priority** | Must | **Test** | TC-PERF-02 | **Release** | R1 |

### NFR-PERF-003 — Concurrent users

| Field | Content |
|-------|---------|
| **Requirement** | Support **Estimate** 50–100 concurrent interactive users for internal pilot without hard failure. |
| **Priority** | Must | **Metric-to-measure** | error rate under load test | **Release** | R1 |

### NFR-REL-001 — Backup

| Field | Content |
|-------|---------|
| **Requirement** | Daily DB backup for stage/prod-like; documented restore drill once before go-live. |
| **Priority** | Must | **Release** | R1 |

### NFR-REL-002 — Audit durability

| Field | Content |
|-------|---------|
| **Requirement** | Audit and ledger tables included in backup/restore. |
| **Priority** | Must | **Release** | R1 |

### NFR-OPS-001 — Docker Compose

| Field | Content |
|-------|---------|
| **Requirement** | Dev/stage runnable via Docker Compose with documented env vars. |
| **Priority** | Must | **Story** | US-OPS-02 | **Test** | TC-OPS-01 | **Release** | R1 |

### NFR-OPS-002 — OpenAPI

| Field | Content |
|-------|---------|
| **Requirement** | Publish OpenAPI 3 for `/api/v1` matching implemented endpoints. |
| **Priority** | Must | **Story** | US-OPS-03 | **Test** | TC-OPS-02 | **Release** | R1 |

### NFR-OPS-003 — CI pipeline

| Field | Content |
|-------|---------|
| **Requirement** | CI runs lint, unit tests, build on PR; fail blocks merge. |
| **Priority** | Must | **Story** | US-OPS-04 | **Test** | TC-OPS-03 | **Release** | R1 |

### NFR-USA-001 — Accessibility baseline

| Field | Content |
|-------|---------|
| **Requirement** | Key flows meet WCAG 2.2 AA targets for contrast, keyboard, labels (**Assumption**: aim AA on P0 screens). |
| **Priority** | Must | **Story** | US-UX-01 | **Test** | TC-A11Y-01 | **Release** | R1 |

### NFR-USA-002 — Responsive web

| Field | Content |
|-------|---------|
| **Requirement** | ESS/Manager usable at 360px width for core actions. |
| **Priority** | Must | **Test** | TC-UX-01 | **Release** | R1 |

### NFR-MAINT-001 — Modular monolith

| Field | Content |
|-------|---------|
| **Requirement** | Domain modules separated (Nest modules) with clear boundaries for future extraction. |
| **Priority** | Must | **Label** | **Fact** architecture lock | **Release** | R1 |

### NFR-PORT-001 — tenant_id readiness

| Field | Content |
|-------|---------|
| **Requirement** | Schema includes `tenant_id` on tenant-owned tables; runtime single tenant. |
| **Priority** | Must | **Release** | R1 |

---

## 15. Traceability matrix (summary)

| Requirement | Story | Test | Release |
|-------------|-------|------|---------|
| FR-IDN-001..004 | US-IDN-* / US-CORE-03 | TC-IDN-* | R1 |
| FR-RBAC-001..002 | US-RBAC-* | TC-RBAC-* | R1 |
| FR-CORE-001..005 | US-CORE-* / US-MIG-02 | TC-CORE-* | R1 |
| FR-LEAVE-001..005 | US-LEAVE-* | TC-LEAVE-* | R1 |
| FR-ATT-001..005 | US-ATT-* | TC-ATT-* | R1 |
| FR-WF-001..003 | US-WF-* | TC-WF-* | R1 |
| FR-DOC-001..003 | US-DOC-* | TC-DOC-* | R1 |
| FR-ESS-001..002 | US-ESS-* | TC-ESS-* | R1 |
| FR-NOTIF-001..002 | US-NOTIF-* | TC-NOTIF-* | R1 |
| FR-AUD-001..002 | US-AUD-* | TC-AUD-* | R1 |
| FR-RPT-001 | US-RPT-01 | TC-RPT-01 | R1 |
| FR-MIG-001 | US-MIG-01 | TC-MIG-01 | R1 |
| NFR-SEC/PERF/OPS/USA/* | US-OPS/UX-* | TC-SEC/PERF/OPS/A11Y-* | R1 |

Detailed story text: [07-user-stories](07-user-stories.md).

---

*SRS changes require version bump and impact on test suite. Owner: Lead Architect + BA.*
