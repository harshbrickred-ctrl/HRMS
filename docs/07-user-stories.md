# 07 — User Stories & Sprint Mapping

**Product:** PeopleOS MVP  
**Related:** [06-srs-functional](06-srs-functional.md) · [05-product-requirements-mvp](05-product-requirements-mvp.md) · [25-sprint-plan](25-sprint-plan.md)  
**Sprint model:** 2-week sprints · Weeks 1–12 · 4 engineers  
**Story points:** Planning aid only (**Estimate**); capacity ~145–155 effective eng-days.

---

## Evidence labels

**Fact** | **Assumption** | **Estimate** | **Metric-to-measure**

---

## 1. Story format

Each story: **ID · As a… · I want… · So that… · FR mapping · Acceptance criteria · Sprint suggestion · Notes**

Priority: P0 unless marked P1.

---

## 2. Identity & RBAC stories

### US-IDN-01 — Login
**As an** employee **I want** to sign in with email/password **so that** I can access ESS securely.  
**FR:** FR-IDN-001 · **Sprint:** 3–4  
**AC:**
- [ ] Valid credentials open role-appropriate home
- [ ] Invalid credentials show generic error
- [ ] Account lock after N failures with clear message
- [ ] Login success/fail audited

### US-IDN-02 — Logout
**As a** user **I want** to log out **so that** my session cannot be reused.  
**FR:** FR-IDN-002 · **Sprint:** 3–4  
**AC:**
- [ ] Logout invalidates session/token
- [ ] Protected routes redirect to login

### US-IDN-03 — Password reset
**As a** user **I want** to reset my password via email **so that** I can recover access.  
**FR:** FR-IDN-003 · **Sprint:** 3–4  
**AC:**
- [ ] Reset email contains time-limited link
- [ ] Expired/reused token fails safely
- [ ] SMTP failure shows support guidance

### US-RBAC-01 — Assign roles
**As a** security/IT admin **I want** to assign roles **so that** least-privilege access is enforced.  
**FR:** FR-RBAC-001 · **Sprint:** 3–4  
**AC:**
- [ ] Assign/revoke from catalog
- [ ] Change audited
- [ ] User gains/loses API access accordingly

### US-RBAC-02 — Permission enforcement
**As a** system owner **I want** APIs to deny unauthorized calls **so that** UI tricks cannot escalate privileges.  
**FR:** FR-RBAC-002 · NFR-SEC-003 · **Sprint:** 3–4  
**AC:**
- [ ] Cross-role access tests return 403
- [ ] UI hides unauthorized actions on P0 screens

---

## 3. Core HR stories

### US-CORE-01 — Org structure
**As an** HR executive **I want** to maintain departments, designations, and locations **so that** employees are assigned correctly.  
**FR:** FR-CORE-001 · **Sprint:** 5  
**AC:**
- [ ] CRUD/deactivate entities
- [ ] Cannot hard-delete in-use entities

### US-CORE-02 — Create employee
**As an** HR executive **I want** to create an employee with mandatory fields **so that** the person exists in the SoR.  
**FR:** FR-CORE-002 · **Sprint:** 5–6  
**AC:**
- [ ] Validation on mandatory fields
- [ ] Unique employee code & work email
- [ ] Appears in search & headcount

### US-CORE-03 — Provision user on hire
**As an** HR executive **I want** the system to create a login when I hire **so that** the employee can access ESS.  
**FR:** FR-IDN-004 · **Sprint:** 5–6  
**AC:**
- [ ] User linked to employee
- [ ] Invite/reset path triggered when SMTP available

### US-CORE-04 — Employment events
**As an** HR executive **I want** to transfer, promote, or exit an employee **so that** history and access stay accurate.  
**FR:** FR-CORE-003 · **Sprint:** 6  
**AC:**
- [ ] Transfer/promote recorded in history
- [ ] Exit disables login
- [ ] Manager cycles rejected

### US-CORE-05 — Search
**As an** HR user **I want** to search employees **so that** I can find records quickly.  
**FR:** FR-CORE-004 · **Sprint:** 5–6  
**AC:**
- [ ] Search by name/code/email/dept/status
- [ ] Manager only sees team scope

---

## 4. Leave stories

### US-LEAVE-01 — Configure policies
**As an** HR Head **I want** to configure leave types/policies **so that** requests follow company rules.  
**FR:** FR-LEAVE-001 · **Sprint:** 6–7  
**AC:**
- [ ] Create/activate leave types
- [ ] Policy parameters persisted
- [ ] Effective dating or version note documented

### US-LEAVE-02 — Balances & adjustments
**As an** employee **I want** to see my balances; **as** HR **I want** to adjust with reason **so that** disputes are transparent.  
**FR:** FR-LEAVE-002 · **Sprint:** 6–7  
**AC:**
- [ ] ESS shows balances by type
- [ ] HR adjustment requires reason + ledger entry
- [ ] Ledger reconciles to display

### US-LEAVE-03 — Apply leave
**As an** employee **I want** to apply leave **so that** I can request time off without email.  
**FR:** FR-LEAVE-003 · **Sprint:** 7  
**AC:**
- [ ] Date range / half-day supported
- [ ] Insufficient balance / overlap blocked
- [ ] Workflow task created; notification sent

### US-LEAVE-04 — Approve leave
**As a** manager **I want** to approve/reject leave from my inbox **so that** decisions are timely and auditable.  
**FR:** FR-LEAVE-004 · FR-WF-002 · **Sprint:** 7  
**AC:**
- [ ] Approve consumes balance
- [ ] Reject requires comment; no consumption
- [ ] Employee notified

### US-LEAVE-05 — Holidays
**As an** HR executive **I want** to maintain holidays **so that** leave/attendance respect non-working days.  
**FR:** FR-LEAVE-005 · **Sprint:** 6  
**AC:**
- [ ] Holidays by location/company
- [ ] Visible on ESS calendar

---

## 5. Attendance stories

### US-ATT-01 — Mark attendance
**As an** employee **I want** to mark today’s attendance **so that** my presence is recorded.  
**FR:** FR-ATT-001 · **Sprint:** 8  
**AC:**
- [ ] Mark within window
- [ ] Locked period blocks mark
- [ ] Visible in month view

### US-ATT-02 — Import CSV
**As an** HR executive **I want** to import attendance CSV **so that** device/export data lands in PeopleOS.  
**FR:** FR-ATT-002 · **Sprint:** 8  
**AC:**
- [ ] Row validation report
- [ ] Idempotent upsert
- [ ] Batch audited

### US-ATT-03 — Month views
**As an** employee/manager **I want** month views **so that** I can spot gaps and plan coverage.  
**FR:** FR-ATT-003 · **Sprint:** 8–9  
**AC:**
- [ ] Self month view
- [ ] Team month view with exceptions
- [ ] No cross-team leakage

### US-ATT-04 — Corrections
**As an** employee **I want** to request an attendance correction **so that** mistakes are fixed with approval.  
**FR:** FR-ATT-004 · **Sprint:** 8  
**AC:**
- [ ] Request captures before/after + reason
- [ ] Approval updates record
- [ ] Audit trail complete

### US-ATT-05 — Shifts (basic)
**As an** HR executive **I want** to assign basic shifts **so that** expectations are clear.  
**FR:** FR-ATT-005 · **Sprint:** 8  
**AC:**
- [ ] Shift master + assignment on profile

---

## 6. Workflow stories

### US-WF-01 — Define workflows
**As an** HR Head **I want** sequential approval definitions **so that** leave/corrections route consistently.  
**FR:** FR-WF-001 · **Sprint:** 5–6  
**AC:**
- [ ] Steps by manager/role/user
- [ ] One active definition per type (per assumption)
- [ ] Changes audited

### US-WF-02 — Inbox
**As a** manager **I want** a single approvals inbox **so that** I do not hunt across modules.  
**FR:** FR-WF-002 · **Sprint:** 7–9  
**AC:**
- [ ] Pending tasks listed with type, requester, age
- [ ] Approve/reject from inbox
- [ ] Deep links work from email/in-app

### US-WF-03 — Pending reminders (P0)
**As an** approver **I want** reminders on aging tasks **so that** I do not miss requests.  
**FR:** FR-WF-003 · **Sprint:** 7–9 · **Priority:** P0  
**AC:**
- [ ] Reminder in-app + email after threshold
- [ ] Audit/notification event written

### US-WF-04 — Escalation (P1 stretch)
**As an** HR Head **I want** overdue approvals escalated **so that** requests do not stall.  
**FR:** FR-WF-004 · **Sprint:** only if buffer · **Priority:** P1  
**AC:**
- [ ] Escalation reassigns + notifies
- [ ] Audit event written

---

## 7. Documents stories

### US-DOC-01 — Upload
**As an** HR/employee **I want** to upload documents to categories **so that** records are centralized.  
**FR:** FR-DOC-001 · **Sprint:** 9–10  
**AC:**
- [ ] Allowlist type/size enforced
- [ ] Metadata stored
- [ ] AuthZ on upload category

### US-DOC-02 — Download ACL
**As an** employee **I want** to download my documents; **as** HR control access **so that** confidentiality holds.  
**FR:** FR-DOC-002 · **Sprint:** 9–10  
**AC:**
- [ ] Unauthorized download denied + audited
- [ ] Authorized download succeeds

### US-DOC-03 — Categories & soft delete
**As an** HR executive **I want** categories and soft delete **so that** libraries stay governed.  
**FR:** FR-DOC-003 · **Sprint:** 9–10  
**AC:**
- [ ] Category ACL configurable
- [ ] Soft delete requires reason; hidden from ESS

---

## 8. ESS / Manager / Notifications / Audit / Reports

### US-ESS-01 — ESS home
**As an** employee **I want** a home with quick actions **so that** I finish tasks in few clicks.  
**FR:** FR-ESS-001 · NFR-USA-002 · **Sprint:** 9–10  
**AC:**
- [ ] Balances, pending, notifications, quick actions present
- [ ] Apply leave ≤2 clicks from home
- [ ] Usable at 360px width

### US-ESS-02 — Manager home
**As a** manager **I want** inbox + team signals on home **so that** I act daily without hunting.  
**FR:** FR-ESS-002 · **Sprint:** 9–10  
**AC:**
- [ ] Inbox count accurate
- [ ] Team on leave + attendance exceptions widgets

### US-NOTIF-01 — In-app
**As a** user **I want** in-app notifications **so that** I see status changes in-product.  
**FR:** FR-NOTIF-001 · **Sprint:** 9  
**AC:**
- [ ] Unread badge; mark read / mark all
- [ ] Deep link opens target

### US-NOTIF-02 — Email
**As a** user **I want** email for critical approval events **so that** I am notified even when not logged in.  
**FR:** FR-NOTIF-002 · **Sprint:** 9  
**AC:**
- [ ] Task assigned / decided / escalated emails
- [ ] SMTP failure does not block in-app write

### US-AUD-01 — Audit write
**As a** compliance stakeholder **I want** sensitive actions audited **so that** disputes are reconstructable.  
**FR:** FR-AUD-001 · **Sprint:** 3–4 (hook) · verify 11  
**AC:**
- [ ] Leave decide, balance adjust, role change, doc download create audits

### US-AUD-02 — Audit query
**As a** security admin **I want** to filter/export audit **so that** I can investigate.  
**FR:** FR-AUD-002 · **Sprint:** 10–11  
**AC:**
- [ ] Filter by actor/entity/date
- [ ] CSV export size-capped

### US-RPT-01 — Ops reports
**As an** HR Head **I want** operational reports with CSV export **so that** I stop building Excel extracts.  
**FR:** FR-RPT-001 · NFR-PERF-002 · **Sprint:** 10  
**AC:**
- [ ] All six P0 reports runnable
- [ ] AuthZ scope enforced
- [ ] p95 target validated on staging dataset

---

## 9. Migration & platform stories

### US-MIG-01 — greytHR migration toolkit
**As an** HR Head **I want** dry-run CSV migration with reconciliation **so that** cutover risk is visible.  
**FR:** FR-MIG-001 · **Sprint:** Discovery 1–2 · build 10–11 · dry-run 11  
**AC:**
- [ ] Templates documented
- [ ] Dry-run validation report
- [ ] Reconciliation summary
- [ ] Successful dry-run before pilot

### US-MIG-02 — Employee bulk import
**As an** HR executive **I want** CSV employee import **so that** initial load is feasible.  
**FR:** FR-CORE-005 · **Sprint:** 6 / 11  
**AC:**
- [ ] Dry-run + commit
- [ ] Error CSV for bad rows

### US-OPS-01 — TLS & secrets baseline
**As an** IT admin **I want** secure transport and secret handling **so that** credentials are not leaked.  
**FR:** NFR-SEC-001 · **Sprint:** 11  
**AC:**
- [ ] Stage/prod TLS documented
- [ ] Secrets not in git

### US-OPS-02 — Docker Compose
**As a** developer **I want** Compose-based stack **so that** onboarding is repeatable.  
**FR:** NFR-OPS-001 · **Sprint:** 3–4  
**AC:**
- [ ] Documented `up` brings API, web, DB

### US-OPS-03 — OpenAPI
**As an** integrator **I want** OpenAPI for `/api/v1` **so that** contracts are explicit.  
**FR:** NFR-OPS-002 · **Sprint:** 4 → maintain ongoing  
**AC:**
- [ ] Spec published and CI-checked for drift (**Assumption**: lint)

### US-OPS-04 — CI
**As a** tech lead **I want** CI lint/test/build **so that** broken code cannot merge silently.  
**FR:** NFR-OPS-003 · **Sprint:** 3–4  
**AC:**
- [ ] PR pipeline required checks

### US-UX-01 — Accessibility baseline
**As an** employee using assistive tech **I want** labeled controls and keyboard paths **so that** core flows are usable.  
**FR:** NFR-USA-001 · **Sprint:** 9–11  
**AC:**
- [ ] Login, apply leave, inbox keyboard operable
- [ ] Contrast checks on primary themes

---

## 10. P1 stretch stories (do not schedule unless buffer)

| ID | Story | FR (future) | Note |
|----|-------|-------------|------|
| US-ATS-01 | Light candidate pipeline | — | After P0 UAT green |
| US-ONB-01 | Onboarding checklist | — | Depends Docs |
| US-AST-01 | Assign asset to employee | — | — |
| US-HD-01 | Simple HR ticket | — | Reuse WF |

---

## 11. Sprint suggestions (story bundles)

Aligned with [00-README](00-README.md) week plan (**Estimate**).

| Sprint | Weeks | Focus | Primary stories |
|--------|-------|-------|-----------------|
| S0 | 1–2 | Discovery, PRD freeze, UX, ADRs, greytHR export discovery | US-MIG-01 (discovery tasks), UX wireframes |
| S1 | 3–4 | Foundation: auth, RBAC, audit hooks, Docker, CI, OpenAPI | US-IDN-*, US-RBAC-*, US-AUD-01 (hooks), US-OPS-02..04 |
| S2 | 5–6 | Core HR + WF definitions + leave policy groundwork | US-CORE-*, US-WF-01, US-LEAVE-01/05, US-MIG-02 start |
| S3 | 7 | Leave apply/approve + inbox + notifications start | US-LEAVE-02..04, US-WF-02/03, US-NOTIF start |
| S4 | 8 | Attendance mark/import/corrections/shifts | US-ATT-* |
| S5 | 9–10 | ESS/Manager, Docs, Notifications polish, Reports | US-ESS-*, US-DOC-*, US-NOTIF-*, US-RPT-01, US-AUD-02 |
| S6 | 11–12 | Security hardening, UAT, migration dry-run, pilot, training | US-MIG-01 complete, US-OPS-01, US-UX-01, defect burn-down |

### 11.1 Dependency graph (stories)

```text
US-IDN/RBAC → US-CORE → US-WF-01 → US-LEAVE / US-ATT-04
US-ATT-01/02 → US-ATT-03
US-WF-02 ← Leave/Att correction
US-NOTIF ← WF/Leave/Att events
US-ESS ← Leave + Att + WF + Docs + Notif
US-MIG ← Core + Leave balances + Att history
US-RPT ← Core + Leave + Att + WF data quality
```

### 11.2 Definition of Done (story-level)

- [ ] FR AC met; unit/integration tests linked (`TC-*`)
- [ ] OpenAPI updated if API changed
- [ ] Audit events verified when applicable
- [ ] UX reviewed against [09](09-ux-ui-specification.md) for ESS/Manager/HR surfaces
- [ ] No P2 scope sneaked in

---

## 12. Traceability index

| Story | FR/NFR | Sprint |
|-------|--------|--------|
| US-IDN-01..03 | FR-IDN-001..003 | S1 |
| US-RBAC-01..02 | FR-RBAC-001..002 | S1 |
| US-CORE-01..05 | FR-CORE-001..004, FR-IDN-004 | S2 |
| US-LEAVE-01..05 | FR-LEAVE-001..005 | S2–S3 |
| US-ATT-01..05 | FR-ATT-001..005 | S4 |
| US-WF-01..03 | FR-WF-001..003 | S2–S3 |
| US-DOC-01..03 | FR-DOC-001..003 | S5 |
| US-ESS-01..02 | FR-ESS-001..002 | S5 |
| US-NOTIF-01..02 | FR-NOTIF-001..002 | S5 |
| US-AUD-01..02 | FR-AUD-001..002 | S1/S5 |
| US-RPT-01 | FR-RPT-001 | S5 |
| US-MIG-01..02 | FR-MIG-001, FR-CORE-005 | S0/S2/S6 |
| US-OPS-01..04 | NFR-SEC/OPS-* | S1/S6 |
| US-UX-01 | NFR-USA-001 | S5–S6 |

---

*Backlog owner: BA + Lead. Sprint commitment happens in planning; this file is the seed backlog, not a promise of 100% story completion without triage.*
