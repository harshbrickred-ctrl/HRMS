# 11 — Domain Architecture

**Status:** Foundation baseline  
**Audience:** Product, BA, backend engineers  
**Related:** [10-system-architecture](10-system-architecture.md), [12-database-design](12-database-design.md), [15-multi-tenant-strategy](15-multi-tenant-strategy.md), ADR-001, ADR-006

---

## 1. Purpose

Defines **bounded contexts**, MVP modules, deferred domains, aggregates, and domain events for PeopleOS. Aligns product language with NestJS module boundaries inside the modular monolith.

| Statement | Label |
|-----------|-------|
| India IT consultancy ~500 employees; greytHR incumbent | **Fact** (org context) |
| Payroll statutory engine not built; integration boundary only | **Fact** (locked) |
| ATS, Assets, full LMS, Benefits engines deferred | **Assumption** (MVP freeze) |
| Module list below is the build contract for 12-week MVP | **Estimate** (capacity-fit) |

---

## 2. Ubiquitous language (selected)

| Term | Meaning |
|------|---------|
| Tenant | Logical customer/org isolation key (`tenant_id`); MVP = one runtime tenant |
| Organization / OrgUnit | Internal hierarchy (BU, department, team) |
| Employee | Person with employment relationship(s); not identical to User |
| User | Login principal; usually 1:1 with Employee for ESS |
| Employment | Period + type (full-time, contractor) under an Employee |
| LeaveRequest | Request against a LeaveType with balance impact |
| Approval | Workflow step decision (approve/reject/delegate) |
| AttendanceRecord | Presence fact for a date/shift (manual or imported) |
| Document | HR file metadata + storage object key |
| FeatureFlag | Runtime toggle scoped to tenant (and optionally role) |

---

## 3. DDD bounded contexts

```text
┌──────────────── Identity & Access ────────────────┐
│ User, Session, MFA, Role, Permission, Policy      │
└───────────────────────┬───────────────────────────┘
                        │ authorizes
┌───────────────────────▼───────────────────────────┐
│              Organization & Workforce               │
│ Tenant, OrgUnit, Employee, Employment, Assignment │
└───────┬─────────────────┬─────────────────┬───────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Leave Mgmt    │ │ Attendance    │ │ Documents     │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘
        │                 │                 │
        └────────┬────────┴────────┬────────┘
                 ▼                 ▼
        ┌──────────────┐  ┌────────────────┐
        │  Workflow    │  │ Notifications  │
        └──────────────┘  └────────────────┘
                 │
                 ▼
        ┌──────────────┐  ┌────────────────┐
        │  Reporting   │  │ Integrations   │
        │              │  │ (Payroll edge) │
        └──────────────┘  └────────────────┘
```

| Context | Responsibility | Owns writes |
|---------|----------------|-------------|
| Identity & Access | AuthN/AuthZ, sessions, MFA | Users, roles, permissions, audit of auth |
| Organization & Workforce | Structure + employee master | Org, employee, employment |
| Leave | Policies, balances, requests | Leave types, balances, requests |
| Attendance | Presence, exceptions | Attendance records, shifts (light) |
| Workflow | Generic approval orchestration | Workflow definitions, instances, tasks |
| Documents | HR document lifecycle | Document metadata |
| Notifications | Delivery of messages | Notification outbox / templates |
| Reporting | Analytical reads/exports | Report jobs, cached extracts |
| Admin / Platform | Flags, tenant settings | Feature flags, system config |
| Integrations | Anti-corruption for payroll/IdP | Integration run logs, mappings |

**Shared kernel (thin):** `TenantId`, `EmployeeId`, `Money` (rare), `DateRange`, audit envelope types. Keep shared kernel small.

---

## 4. Module catalog (MVP + deferred)

For each module: purpose, users, capabilities, entities, workflows, dependencies, complexity, Priority, MVP status, Phase 2, SaaS relevance.

Complexity scale: **S** / **M** / **L** (engineering effort relative to 12-week plan).  
Priority: **P0** (must), **P1** (should), **P2** (later).

---

### 4.1 Core HR (Organization & Workforce)

| Field | Content |
|-------|---------|
| **Purpose** | Single source of truth for people and org structure used by all other modules |
| **Users** | HR Admin, Manager (read), Employee (self read) |
| **Capabilities** | Create/update employee; employment history; org units; reporting line; basic personal/contact; status (active/exit) |
| **Entities** | `Tenant`, `OrgUnit`, `Employee`, `Employment`, `EmployeeAssignment`, `Location` (light) |
| **Workflows** | Hire/onboard record creation; transfer; exit marking; manager change |
| **Dependencies** | Identity (user link), Admin (flags) |
| **Complexity** | **L** |
| **Priority** | **P0** |
| **MVP status** | **In MVP** — fields subset sufficient for leave/attendance; full greytHR parity not required |
| **Phase 2** | Richer job architecture, positions, contractors packaging, bulk HR ops |
| **SaaS relevance** | **High** — every tenant needs Core HR; tenancy + org model is product foundation |

---

### 4.2 Leave

| Field | Content |
|-------|---------|
| **Purpose** | Policy-driven leave request, balance, and approval |
| **Users** | Employee, Manager, HR |
| **Capabilities** | Leave types; accruals/balances (simplified); apply; cancel; approve/reject; calendar blackouts (light); India holiday calendar seed |
| **Entities** | `LeaveType`, `LeavePolicy`, `LeaveBalance`, `LeaveRequest`, `LeaveTransaction` |
| **Workflows** | Apply → workflow tasks → decision → balance post; HR adjustment |
| **Dependencies** | Core HR, Workflow, Notifications; Reporting (exports) |
| **Complexity** | **L** |
| **Priority** | **P0** |
| **MVP status** | **In MVP** — common types (CL/SL/EL or org-defined); complex LOP/encashment rules deferred where possible |
| **Phase 2** | Comp-off, advanced accrual engines, carry-forward edge cases, team heatmap |
| **SaaS relevance** | **High** — sticky daily-use module; policy configurability is differentiator |

---

### 4.3 Attendance

| Field | Content |
|-------|---------|
| **Purpose** | Capture presence and exceptions; feed manager/HR visibility and future payroll export |
| **Users** | Employee, Manager, HR |
| **Capabilities** | Manual daily status / web punch (optional); shift assignment light; exception requests; manager correction |
| **Entities** | `Shift` (light), `AttendanceRecord`, `AttendanceException` |
| **Workflows** | Exception → approval; period lock for export |
| **Dependencies** | Core HR, Workflow, Notifications; Integrations (payroll timesheet extract) |
| **Complexity** | **M**–**L** (hardware clocks push to **L**) |
| **Priority** | **P0** (light) / biometric **P2** |
| **MVP status** | **In MVP (light)** — no full biometric device farm unless discovery proves mandatory |
| **Phase 2** | Device integrations, geofencing, advanced rosters |
| **SaaS relevance** | **Medium–High** — varies by customer; keep adapter-friendly |

---

### 4.4 Workflow

| Field | Content |
|-------|---------|
| **Purpose** | Reusable approval engine (leave, attendance exceptions, document access requests) |
| **Users** | Approvers (managers/HR), Admins (define flows) |
| **Capabilities** | Define multi-step flows; assign by role/manager; approve/reject/delegate; SLA reminders (basic) |
| **Entities** | `WorkflowDefinition`, `WorkflowInstance`, `WorkflowTask`, `WorkflowAction` |
| **Workflows** | Instantiation on domain event; task completion; terminal state callbacks to owning module |
| **Dependencies** | Identity/RBAC, Notifications; owning modules call workflow API |
| **Complexity** | **M** |
| **Priority** | **P0** |
| **MVP status** | **In MVP** — linear steps + manager-of-requester; parallel/conditional graphs Phase 2 |
| **Phase 2** | Conditional branching, escalation matrices, admin visual designer |
| **SaaS relevance** | **High** — configuration surface for enterprise sales |

---

### 4.5 Documents

| Field | Content |
|-------|---------|
| **Purpose** | Store and govern HR documents (offer letters, IDs, policies) with access control |
| **Users** | Employee (own), HR, Manager (limited) |
| **Capabilities** | Upload/download via signed URL; categorize; retention tag; access audit |
| **Entities** | `Document`, `DocumentCategory`, `DocumentAccessGrant` |
| **Workflows** | Upload → scan hook (Phase 2) → ACL; employee request access → approve |
| **Dependencies** | Core HR, RBAC, Storage adapter, Audit |
| **Complexity** | **M** |
| **Priority** | **P0** (basic) |
| **MVP status** | **In MVP** — categories + ACL + audit; e-sign deferred |
| **Phase 2** | E-sign, virus scanning, legal hold |
| **SaaS relevance** | **High** — trust-sensitive; storage cost/isolation matters |

---

### 4.6 Notifications

| Field | Content |
|-------|---------|
| **Purpose** | Reliable user messaging (email first; in-app later) |
| **Users** | System on behalf of all personas |
| **Capabilities** | Template render; outbox; Mailpit/SMTP/ACS; preference stubs |
| **Entities** | `NotificationTemplate`, `NotificationMessage`, `OutboxEntry` |
| **Workflows** | Domain event → enqueue → send → record status |
| **Dependencies** | Identity (email), all producing modules |
| **Complexity** | **S**–**M** |
| **Priority** | **P0** |
| **MVP status** | **In MVP** — email for leave/approval; in-app bell Phase 2 |
| **Phase 2** | SMS/push, digests, user preferences UI |
| **SaaS relevance** | **Medium** — expected table stakes; multi-tenant template branding later |

---

### 4.7 Reporting

| Field | Content |
|-------|---------|
| **Purpose** | Operational reports and CSV/XLSX extracts for HR |
| **Users** | HR, leadership (limited) |
| **Capabilities** | Headcount, leave liability (simple), attendance summary, audit extracts |
| **Entities** | `ReportDefinition`, `ReportRun` (jobs) |
| **Workflows** | Request report → async job → download link |
| **Dependencies** | Read models from Core/Leave/Attendance; Documents for file delivery |
| **Complexity** | **M** |
| **Priority** | **P1** (subset **P0**: leave balance & team leave) |
| **MVP status** | **Partial MVP** — few fixed reports; BI tool integration deferred |
| **Phase 2** | Scheduled reports, warehouse export |
| **SaaS relevance** | **High** for mid-market; start with templates |

---

### 4.8 Admin (Platform)

| Field | Content |
|-------|---------|
| **Purpose** | Tenant settings, feature flags, system health visibility, audit search |
| **Users** | System Admin, HR Admin (subset) |
| **Capabilities** | Feature flags; holiday calendar upload; integration toggles; audit query |
| **Entities** | `FeatureFlag`, `TenantSettings`, `AuditEvent` (query), `HolidayCalendar` |
| **Workflows** | Flag change with audit; emergency disable module |
| **Dependencies** | All modules (consume flags) |
| **Complexity** | **S**–**M** |
| **Priority** | **P0** |
| **MVP status** | **In MVP** — flags + settings + audit viewer basic |
| **Phase 2** | Subscription/billing entities (SaaS), impersonation with strict controls |
| **SaaS relevance** | **Critical** — operability of multi-tenant product |

**Note:** `Subscription` entity is modeled conceptually and **deferred** for runtime MVP (see [15](15-multi-tenant-strategy.md)).

---

### 4.9 ESS (Employee Self-Service) — experience module

| Field | Content |
|-------|---------|
| **Purpose** | Employee-facing UX composition over Core/Leave/Attendance/Documents |
| **Users** | Employees |
| **Capabilities** | Profile view; leave apply/history; attendance view; my documents; tasks inbox |
| **Entities** | None owned — uses other contexts (BFF DTOs only) |
| **Workflows** | UX flows only; domain rules stay in owning modules |
| **Dependencies** | All P0 domains + Identity |
| **Complexity** | **M** (UI) |
| **Priority** | **P0** |
| **MVP status** | **In MVP** |
| **Phase 2** | Mobile app, richer profile edits with approval |
| **SaaS relevance** | **High** — primary adoption surface |

---

### 4.10 Manager — experience module

| Field | Content |
|-------|---------|
| **Purpose** | Manager UX for team approvals and visibility |
| **Users** | People managers |
| **Capabilities** | Approval queue; team leave calendar; team attendance exceptions; direct report list |
| **Entities** | None owned |
| **Workflows** | Approval UX bound to Workflow tasks |
| **Dependencies** | Workflow, Leave, Attendance, Core HR |
| **Complexity** | **M** |
| **Priority** | **P0** |
| **MVP status** | **In MVP** |
| **Phase 2** | Team analytics, delegation UI advanced |
| **SaaS relevance** | **High** |

---

## 5. Deferred domains (not MVP)

| Module | Purpose | Why deferred | SaaS relevance | Complexity if built |
|--------|---------|--------------|----------------|---------------------|
| ATS / Recruiting | Requisitions, candidates | Large product; greytHR/other tools may cover | High | **L** |
| Assets | Asset assign/return | Not in critical replacement path | Medium | **M** |
| Learning (LMS) | Courses, assignments | Separate product category | Medium | **L** |
| Performance | Goals, reviews | Cycle-heavy; post-stabilization | High | **L** |
| Benefits | Plans, enrollments | Compliance-heavy | Medium | **L** |
| Payroll engine | Statutory payslip calc | **Locked:** integrate only | N/A (boundary) | **XL** |
| Expenses | Claims | Nice-to-have | Medium | **M** |
| Helpdesk / HR tickets | Case mgmt | Can use existing ITSM | Low–Medium | **M** |

---

## 6. Aggregates (write models)

| Aggregate root | Boundary invariants (selected) | Context |
|----------------|--------------------------------|---------|
| `Employee` | One active primary employment rule (configurable); org assignment consistency | Workforce |
| `LeaveRequest` | Cannot approve if balance insufficient (policy-dependent); cancel only in non-terminal states | Leave |
| `LeaveBalance` | Transactions append-only; balance = f(transactions) | Leave |
| `AttendanceException` | One open exception per date/employee | Attendance |
| `WorkflowInstance` | Single current state; tasks immutable after complete | Workflow |
| `Document` | Storage key immutable; soft-delete retains audit | Documents |
| `User` | Unique login per tenant; password/MFA secrets never logged | Identity |
| `Role` | Permission set changes audited | Identity/RBAC |

**Transaction rule:** one aggregate write per DB transaction in MVP; cross-aggregate consistency via domain events + eventual handlers (e.g., leave approved → notification).

---

## 7. Domain events (catalog)

| Event | Publisher | Subscribers | Notes |
|-------|-----------|-------------|-------|
| `EmployeeHired` | Workforce | Identity (provision user), Notifications | |
| `EmployeeExited` | Workforce | Leave (freeze), Identity (disable), Notifications | |
| `LeaveRequested` | Leave | Workflow, Notifications | |
| `LeaveApproved` / `LeaveRejected` | Leave (after workflow callback) | Notifications, Reporting projections, Integrations | |
| `LeaveCancelled` | Leave | Balance reverse, Notifications | |
| `AttendanceExceptionSubmitted` | Attendance | Workflow | |
| `WorkflowTaskCreated` | Workflow | Notifications | |
| `WorkflowCompleted` | Workflow | Owning module callback | |
| `DocumentUploaded` | Documents | Audit, Notifications (optional) | |
| `UserLoggedIn` / `LoginFailed` | Identity | Audit, security monitors | |
| `MfaChallengeFailed` | Identity | Audit | |
| `FeatureFlagChanged` | Admin | Audit | |

**Transport:** Stage A in-process; Stage B may dual-publish to Service Bus for integrations (ADR-008).

---

## 8. Payroll integration boundary

| Direction | Payload (conceptual) | Owner |
|-----------|----------------------|-------|
| PeopleOS → Payroll | Employee master delta, leave without pay flags, attendance summary | Integrations module |
| Payroll → PeopleOS | Payslip available reference / PDF link (optional) | Integrations; Documents may store link only |

**Anti-corruption:** never leak greytHR IDs into Leave aggregates; store external refs in `IntegrationMapping`.

---

## 9. Priority map (MVP)

| Priority | Modules |
|----------|---------|
| P0 | Core HR, Leave, Workflow, Notifications, Admin (flags/audit), ESS, Manager, Identity/RBAC, Documents (basic), Attendance (light) |
| P1 | Reporting (expanded), richer attendance |
| P2 | ATS, Assets, LMS, Performance, biometric fleet, Subscription billing |

---

## 10. SaaS readiness notes

| Concern | Domain implication |
|---------|-------------------|
| `tenant_id` on all tenant entities | Required now |
| Feature flags per tenant | Admin module |
| Subscription / plans | Entity designed; **runtime deferred** |
| Configurable leave policies | Avoid hard-coding India-only rules in code — data-drive |
| Workflow templates | Per-tenant definitions |

---

## 11. Open product assumptions

1. Manager hierarchy from `Employee.manager_id` or OrgUnit head — pick one primary (**Assumption:** `manager_id` for MVP).  
2. Contractors in MVP — yes as employment type flag (**Assumption**).  
3. Employee self-edit of bank details — **out** until payroll ownership clear (**Assumption**).  
4. Holiday calendar — seeded national + org upload (**Assumption**).

---

*Owner: Product + Solution Architect. Update when MVP freeze changes.*
