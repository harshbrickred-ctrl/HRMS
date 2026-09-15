# 12 — Database Design

**Product:** PeopleOS (internal HRMS)  
**RDBMS:** PostgreSQL 16+  
**Style:** Shared schema, single-tenant runtime, `tenant_id` on all business tables  
**Audience:** Backend, architects, security  
**Status:** Schema v1 conceptual design — required before development  
**Related:** [11-domain-architecture.md](11-domain-architecture.md), [15-multi-tenant-strategy.md](15-multi-tenant-strategy.md), [14-security-architecture.md](14-security-architecture.md)

---

## 1. Design principles

| Principle | Rule |
|-----------|------|
| Tenancy-ready | Every business row carries `tenant_id UUID NOT NULL`. MVP runs one tenant; SaaS later uses shared-schema row isolation. |
| Surrogate keys | Primary keys are `UUID` (`gen_random_uuid()`). Natural keys enforced via unique constraints. |
| Soft delete | Operational entities use `deleted_at TIMESTAMPTZ NULL`. Hard delete only for purge jobs / GDPR-style erasure with audit trail. |
| Effective dating | Org structure and employment use `effective_from` / `effective_to` (inclusive-exclusive or closed-open; document per table). |
| History | Mutable HR facts that affect compliance (employment, designation, compensation stubs) write history rows; do not overwrite silently. |
| Audit | Application writes `audit_event`; DB triggers optional for critical tables later. |
| Retention | Retention policies defined per domain; physical purge is a controlled job, never ad-hoc DELETE from app UI. |
| No payroll engine | `payroll_input` is an **export stub** only. No statutory salary computation tables in MVP. |
| Naming | `snake_case` tables/columns; table names singular or plural consistently — **plural** for this project (`employees`, `leave_requests`). |

### Column conventions (all business tables)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `UUID` PK | Default `gen_random_uuid()` |
| `tenant_id` | `UUID NOT NULL` | FK → `tenants(id)` |
| `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |
| `updated_at` | `TIMESTAMPTZ NOT NULL` | Maintained by app or trigger |
| `created_by` | `UUID NULL` | FK → `users(id)` |
| `updated_by` | `UUID NULL` | FK → `users(id)` |
| `deleted_at` | `TIMESTAMPTZ NULL` | Soft delete marker |

**Fact:** PostgreSQL supports UUID, JSONB, exclusion constraints, and partial indexes suitable for multi-tenant SaaS patterns.  
**Assumption:** Single production database for internal MVP (~500 employees).  
**Estimate:** Core schema ~25–40 tables for MVP; history/audit add volume over time.

---

## 2. Entity catalog (conceptual)

### 2.1 Platform / tenancy

| Entity | Purpose | MVP |
|--------|---------|-----|
| **Tenant** | Logical customer / company partition | Yes (one row) |
| **Organization** | Legal / operating company unit under tenant | Yes |
| **User** | Login identity (may map 1:1 to employee) | Yes |
| **Role / Permission / UserRole** | RBAC | Yes (see identity module) |

### 2.2 Core HR

| Entity | Purpose | MVP |
|--------|---------|-----|
| **Employee** | Person record in HR | Yes |
| **Department** | Org unit | Yes |
| **Designation** | Job title / band | Yes |
| **Location** | Office / work location | Yes |
| **Employment** | Employment spell (join, type, manager, dept) with effective dates | Yes |
| **EmployeeDocument** | Metadata + storage pointer for docs | Yes |

### 2.3 Time & leave

| Entity | Purpose | MVP |
|--------|---------|-----|
| **Shift** | Shift definition | Yes (basic) |
| **Holiday** | Holiday calendar | Yes |
| **Attendance** | Daily attendance / punch summary | Yes (manual + import) |
| **LeavePolicy** | Policy per leave type | Yes |
| **LeaveBalance** | Balance per employee/type/period | Yes |
| **LeaveRequest** | Request + workflow link | Yes |

### 2.4 Payroll bridge (stub)

| Entity | Purpose | MVP |
|--------|---------|-----|
| **PayrollInput** | Exportable attendance/leave/adjustment feed for greytHR or finance | Yes (stub) |

### 2.5 Deferred / P1 entities

| Entity | Purpose | Priority |
|--------|---------|----------|
| **Asset** / **AssetAssignment** | IT asset tracking | P1 |
| **Expense** / **ExpenseLine** | Reimbursements | Deferred |
| **HRRequest** | Generic HR service request / helpdesk | P0/P1 |
| **WorkflowDefinition** | Configurable approval graph | P0 (minimal) |
| **ApprovalInstance** | Runtime approval case | P0 |
| **Notification** | In-app + email outbox | P0 |
| **AuditEvent** | Immutable-ish security/compliance log | P0 |

---

## 3. Cross-cutting rules

### 3.1 Soft delete

- Queries default to `WHERE deleted_at IS NULL`.
- Unique constraints that must ignore deleted rows use **partial unique indexes** (`WHERE deleted_at IS NULL`).
- Soft-deleted employees cannot authenticate; employment end is separate from soft delete.

### 3.2 Effective dating

- Pattern: `effective_from DATE NOT NULL`, `effective_to DATE NULL` (NULL = open-ended).
- Business rule: no overlapping open intervals for the same `(tenant_id, employee_id)` employment primary spell — enforced in application; optional exclusion constraint later.
- Org assignments (dept/manager) may live on `employment` or `employment_assignment_history`.

### 3.3 History

| Source | History approach |
|--------|------------------|
| Employment changes | Insert new `employment` version or `employment_history` row; close prior `effective_to` |
| Leave balance | Ledger-style adjustments (`leave_balance_ledger`) preferred over silent overwrite |
| Documents | Version number + new blob key; prior versions retained per retention |
| Workflow definitions | Immutable versioned definitions; instances pin `definition_version` |

### 3.4 Indexes (baseline)

- `(tenant_id)` leading column on all hot queries.
- `(tenant_id, id)` unique where helpful for composite lookups.
- Partial indexes for active rows.
- GIN on `JSONB` custom attributes only when introduced (SaaS Phase 3+).

### 3.5 Retention (policy sketch — legal review required)

| Domain | Operational retention | Soft-deleted / archive | Notes |
|--------|----------------------|------------------------|-------|
| Audit events | ≥ 7 years (**Assumption** — validate with compliance) | Immutable append | No user delete |
| Employee documents | Per document class (ID proof vs contract) | Legal hold flag | Purge job only |
| Attendance | ≥ 3 years | Aggregate then purge detail | Export before purge |
| Leave | ≥ 3 years after exit | — | Tied to employment |
| Notifications | 90 days delivery log | Truncate | Content may be redacted |
| Payroll input exports | Align with finance | — | Bridge only |

**Metric-to-measure:** Actual storage growth GB/month after 90 days production.

---

## 4. Relationship overview

```
Tenant 1──* Organization
Tenant 1──* User
Tenant 1──* Employee
Employee 0..1──1 User          (optional link)
Employee 1──* Employment
Employee *──1 Department       (via employment / current snapshot)
Employee *──1 Designation
Employee *──1 Location
Employee 1──* EmployeeDocument
Employee 1──* Attendance
Employee 1──* LeaveBalance
Employee 1──* LeaveRequest
LeavePolicy 1──* LeaveBalance
LeaveRequest *──1 ApprovalInstance
WorkflowDefinition 1──* ApprovalInstance
HRRequest *──1 ApprovalInstance
Employee 1──* Notification
* ──* AuditEvent (actor + entity refs)
PayrollInput references attendance/leave period aggregates
Asset (P1) ──* AssetAssignment ── Employee
Expense (deferred) ── Employee
```

---

## 5. Example DDL sketches (core tables)

> Sketches are illustrative for Schema v1. Migrations will be NestJS/TypeORM or Prisma/Flyway — tool choice in ADR. Comments mark intent.

### 5.1 Tenants & organizations

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'active', -- active|suspended
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ NULL,
  CONSTRAINT uq_tenants_code UNIQUE (code)
);

CREATE TABLE organizations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  code            VARCHAR(64) NOT NULL,
  legal_name      VARCHAR(255) NOT NULL,
  display_name    VARCHAR(255) NOT NULL,
  gstin           VARCHAR(32) NULL,          -- India; optional
  cin             VARCHAR(32) NULL,
  timezone        VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  status          VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NULL,
  updated_by      UUID NULL,
  deleted_at      TIMESTAMPTZ NULL,
  CONSTRAINT uq_org_tenant_code UNIQUE (tenant_id, code)
);

CREATE INDEX ix_organizations_tenant ON organizations(tenant_id)
  WHERE deleted_at IS NULL;
```

### 5.2 Users (identity)

```sql
CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  email             CITEXT NOT NULL,
  password_hash     TEXT NULL,                 -- NULL if SSO-only later
  display_name      VARCHAR(255) NOT NULL,
  status            VARCHAR(32) NOT NULL DEFAULT 'active', -- active|locked|disabled
  mfa_enabled       BOOLEAN NOT NULL DEFAULT false,
  last_login_at     TIMESTAMPTZ NULL,
  employee_id       UUID NULL,                 -- set after employee link
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID NULL,
  updated_by        UUID NULL,
  deleted_at        TIMESTAMPTZ NULL,
  CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);

CREATE INDEX ix_users_tenant_status ON users(tenant_id, status)
  WHERE deleted_at IS NULL;
```

> Roles/permissions tables omitted here; see identity module. Prefer `roles`, `permissions`, `role_permissions`, `user_roles` with `tenant_id`.

### 5.3 Departments, designations, locations

```sql
CREATE TABLE departments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  parent_id       UUID NULL REFERENCES departments(id),
  head_employee_id UUID NULL,                  -- FK added after employees
  effective_from  DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to    DATE NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NULL,
  updated_by      UUID NULL,
  deleted_at      TIMESTAMPTZ NULL,
  CONSTRAINT uq_dept_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE designations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  code            VARCHAR(64) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  band            VARCHAR(64) NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NULL,
  updated_by      UUID NULL,
  deleted_at      TIMESTAMPTZ NULL,
  CONSTRAINT uq_desig_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE locations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  city            VARCHAR(128) NULL,
  state           VARCHAR(128) NULL,
  country         CHAR(2) NOT NULL DEFAULT 'IN',
  timezone        VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
  is_remote       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NULL,
  updated_by      UUID NULL,
  deleted_at      TIMESTAMPTZ NULL,
  CONSTRAINT uq_loc_tenant_code UNIQUE (tenant_id, code)
);
```

### 5.4 Employees & employment

```sql
CREATE TABLE employees (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  organization_id   UUID NOT NULL REFERENCES organizations(id),
  employee_code     VARCHAR(64) NOT NULL,      -- company emp ID
  first_name        VARCHAR(128) NOT NULL,
  middle_name       VARCHAR(128) NULL,
  last_name         VARCHAR(128) NOT NULL,
  work_email        CITEXT NOT NULL,
  personal_email    CITEXT NULL,
  mobile            VARCHAR(32) NULL,
  date_of_birth     DATE NULL,                 -- sensitive; access controlled
  gender            VARCHAR(32) NULL,
  status            VARCHAR(32) NOT NULL DEFAULT 'active',
  -- active|onboarding|notice|exited|inactive
  date_of_joining   DATE NULL,
  date_of_exit      DATE NULL,
  current_department_id  UUID NULL REFERENCES departments(id),
  current_designation_id UUID NULL REFERENCES designations(id),
  current_location_id    UUID NULL REFERENCES locations(id),
  manager_employee_id    UUID NULL REFERENCES employees(id),
  user_id           UUID NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID NULL,
  updated_by        UUID NULL,
  deleted_at        TIMESTAMPTZ NULL,
  CONSTRAINT uq_emp_tenant_code UNIQUE (tenant_id, employee_code),
  CONSTRAINT uq_emp_tenant_work_email UNIQUE (tenant_id, work_email)
);

CREATE INDEX ix_employees_tenant_status ON employees(tenant_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX ix_employees_manager ON employees(tenant_id, manager_employee_id)
  WHERE deleted_at IS NULL;

CREATE TABLE employments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  employee_id         UUID NOT NULL REFERENCES employees(id),
  employment_type     VARCHAR(32) NOT NULL, -- full_time|contract|intern
  department_id       UUID NOT NULL REFERENCES departments(id),
  designation_id      UUID NOT NULL REFERENCES designations(id),
  location_id         UUID NOT NULL REFERENCES locations(id),
  manager_employee_id UUID NULL REFERENCES employees(id),
  effective_from      DATE NOT NULL,
  effective_to        DATE NULL,
  change_reason       VARCHAR(255) NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID NULL,
  updated_by          UUID NULL,
  deleted_at          TIMESTAMPTZ NULL
);

CREATE INDEX ix_employments_employee_dates
  ON employments(tenant_id, employee_id, effective_from DESC)
  WHERE deleted_at IS NULL;
```

### 5.5 Employee documents

```sql
CREATE TABLE employee_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  employee_id       UUID NOT NULL REFERENCES employees(id),
  doc_type          VARCHAR(64) NOT NULL,  -- aadhaar|pan|offer|contract|other
  title             VARCHAR(255) NOT NULL,
  storage_provider  VARCHAR(32) NOT NULL DEFAULT 'local', -- local|minio|azure_blob
  storage_key       TEXT NOT NULL,
  content_type      VARCHAR(128) NOT NULL,
  size_bytes        BIGINT NOT NULL,
  checksum_sha256   CHAR(64) NULL,
  version_no        INT NOT NULL DEFAULT 1,
  sensitivity       VARCHAR(32) NOT NULL DEFAULT 'confidential',
  expires_on        DATE NULL,
  legal_hold        BOOLEAN NOT NULL DEFAULT false,
  uploaded_by       UUID NULL REFERENCES users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID NULL,
  updated_by        UUID NULL,
  deleted_at        TIMESTAMPTZ NULL
);

CREATE INDEX ix_emp_docs_employee ON employee_documents(tenant_id, employee_id)
  WHERE deleted_at IS NULL;
```

### 5.6 Shifts, holidays, attendance

```sql
CREATE TABLE shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  break_minutes   INT NOT NULL DEFAULT 0,
  is_flexible     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NULL,
  updated_by      UUID NULL,
  deleted_at      TIMESTAMPTZ NULL,
  CONSTRAINT uq_shifts_tenant_code UNIQUE (tenant_id, code)
);

CREATE TABLE holidays (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  location_id     UUID NULL REFERENCES locations(id), -- NULL = all locations
  holiday_date    DATE NOT NULL,
  name            VARCHAR(255) NOT NULL,
  is_optional     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NULL,
  updated_by      UUID NULL,
  deleted_at      TIMESTAMPTZ NULL,
  CONSTRAINT uq_holiday_tenant_date_loc UNIQUE (tenant_id, holiday_date, location_id)
);

CREATE TABLE attendance_records (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  employee_id       UUID NOT NULL REFERENCES employees(id),
  attendance_date   DATE NOT NULL,
  shift_id          UUID NULL REFERENCES shifts(id),
  status            VARCHAR(32) NOT NULL, -- present|absent|half_day|wfh|holiday|leave|on_duty
  check_in_at       TIMESTAMPTZ NULL,
  check_out_at      TIMESTAMPTZ NULL,
  work_minutes      INT NULL,
  source            VARCHAR(32) NOT NULL DEFAULT 'manual', -- manual|import|device
  notes             TEXT NULL,
  is_locked         BOOLEAN NOT NULL DEFAULT false, -- locked after payroll export
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID NULL,
  updated_by        UUID NULL,
  deleted_at        TIMESTAMPTZ NULL,
  CONSTRAINT uq_attendance_emp_date UNIQUE (tenant_id, employee_id, attendance_date)
);

CREATE INDEX ix_attendance_date ON attendance_records(tenant_id, attendance_date)
  WHERE deleted_at IS NULL;
```

### 5.7 Leave policy, balance, request

```sql
CREATE TABLE leave_policies (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  code              VARCHAR(64) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  leave_type        VARCHAR(64) NOT NULL, -- casual|earned|sick|unpaid|comp_off
  unit              VARCHAR(16) NOT NULL DEFAULT 'day', -- day|hour
  annual_quota      NUMERIC(8,2) NULL,
  carry_forward_max NUMERIC(8,2) NULL,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  gender_restriction VARCHAR(32) NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  effective_from    DATE NOT NULL,
  effective_to      DATE NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID NULL,
  updated_by        UUID NULL,
  deleted_at        TIMESTAMPTZ NULL,
  CONSTRAINT uq_leave_policy_code UNIQUE (tenant_id, code)
);

CREATE TABLE leave_balances (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  employee_id       UUID NOT NULL REFERENCES employees(id),
  leave_policy_id   UUID NOT NULL REFERENCES leave_policies(id),
  period_year       INT NOT NULL,
  opening_balance   NUMERIC(8,2) NOT NULL DEFAULT 0,
  accrued           NUMERIC(8,2) NOT NULL DEFAULT 0,
  used              NUMERIC(8,2) NOT NULL DEFAULT 0,
  adjustment        NUMERIC(8,2) NOT NULL DEFAULT 0,
  closing_balance   NUMERIC(8,2) NOT NULL DEFAULT 0, -- denormalized cache
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by        UUID NULL,
  updated_by        UUID NULL,
  deleted_at        TIMESTAMPTZ NULL,
  CONSTRAINT uq_leave_bal UNIQUE (tenant_id, employee_id, leave_policy_id, period_year)
);

CREATE TABLE leave_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  employee_id         UUID NOT NULL REFERENCES employees(id),
  leave_policy_id     UUID NOT NULL REFERENCES leave_policies(id),
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  days                NUMERIC(8,2) NOT NULL,
  reason              TEXT NULL,
  status              VARCHAR(32) NOT NULL DEFAULT 'draft',
  -- draft|pending|approved|rejected|cancelled|withdrawn
  approval_instance_id UUID NULL,
  submitted_at        TIMESTAMPTZ NULL,
  decided_at          TIMESTAMPTZ NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by          UUID NULL,
  updated_by          UUID NULL,
  deleted_at          TIMESTAMPTZ NULL,
  CONSTRAINT ck_leave_dates CHECK (end_date >= start_date)
);

CREATE INDEX ix_leave_req_emp_status ON leave_requests(tenant_id, employee_id, status)
  WHERE deleted_at IS NULL;
```

### 5.8 Payroll input (export stub)

```sql
CREATE TABLE payroll_input_batches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  period_year     INT NOT NULL,
  period_month    INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  status          VARCHAR(32) NOT NULL DEFAULT 'open', -- open|frozen|exported
  exported_at     TIMESTAMPTZ NULL,
  export_format   VARCHAR(32) NULL,           -- csv|xlsx
  storage_key     TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NULL,
  updated_by      UUID NULL,
  deleted_at      TIMESTAMPTZ NULL,
  CONSTRAINT uq_payroll_batch UNIQUE (tenant_id, period_year, period_month)
);

CREATE TABLE payroll_input_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  batch_id        UUID NOT NULL REFERENCES payroll_input_batches(id),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  employee_code   VARCHAR(64) NOT NULL,
  present_days    NUMERIC(8,2) NULL,
  leave_days      NUMERIC(8,2) NULL,
  unpaid_days     NUMERIC(8,2) NULL,
  remarks         TEXT NULL,
  payload_json    JSONB NULL,                 -- extensible bridge fields
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_payroll_line UNIQUE (tenant_id, batch_id, employee_id)
);
```

**Explicit non-goal:** No `salary_structure`, `component`, `tax_slab`, or PF/ESI computation tables in MVP.

### 5.9 Asset (P1)

```sql
CREATE TABLE assets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  asset_tag       VARCHAR(64) NOT NULL,
  category        VARCHAR(64) NOT NULL, -- laptop|monitor|phone|other
  make_model      VARCHAR(255) NULL,
  serial_no       VARCHAR(128) NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'in_stock',
  -- in_stock|assigned|repair|retired|lost
  purchased_on    DATE NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NULL,
  updated_by      UUID NULL,
  deleted_at      TIMESTAMPTZ NULL,
  CONSTRAINT uq_asset_tag UNIQUE (tenant_id, asset_tag)
);

CREATE TABLE asset_assignments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  asset_id        UUID NOT NULL REFERENCES assets(id),
  employee_id     UUID NOT NULL REFERENCES employees(id),
  assigned_on     DATE NOT NULL,
  returned_on     DATE NULL,
  condition_notes TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NULL,
  updated_by      UUID NULL,
  deleted_at      TIMESTAMPTZ NULL
);
```

### 5.10 Expense (deferred — placeholder only)

```sql
-- DEFERRED: do not migrate in MVP
-- CREATE TABLE expense_claims (...);
-- CREATE TABLE expense_lines (...);
```

### 5.11 HR requests, workflow, approvals

```sql
CREATE TABLE workflow_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  code            VARCHAR(64) NOT NULL,
  name            VARCHAR(255) NOT NULL,
  entity_type     VARCHAR(64) NOT NULL, -- leave_request|hr_request|...
  version_no      INT NOT NULL DEFAULT 1,
  is_published    BOOLEAN NOT NULL DEFAULT false,
  definition_json JSONB NOT NULL,          -- stages, approver rules
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID NULL,
  updated_by      UUID NULL,
  deleted_at      TIMESTAMPTZ NULL,
  CONSTRAINT uq_wf_def_version UNIQUE (tenant_id, code, version_no)
);

CREATE TABLE approval_instances (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
  entity_type           VARCHAR(64) NOT NULL,
  entity_id             UUID NOT NULL,
  status                VARCHAR(32) NOT NULL DEFAULT 'pending',
  current_stage         VARCHAR(64) NULL,
  requested_by          UUID NOT NULL REFERENCES users(id),
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at            TIMESTAMPTZ NULL
);

CREATE INDEX ix_approval_entity ON approval_instances(tenant_id, entity_type, entity_id);

CREATE TABLE approval_actions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  approval_instance_id  UUID NOT NULL REFERENCES approval_instances(id),
  stage                 VARCHAR(64) NOT NULL,
  actor_user_id         UUID NOT NULL REFERENCES users(id),
  action                VARCHAR(32) NOT NULL, -- approve|reject|delegate|comment
  comment               TEXT NULL,
  acted_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hr_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL REFERENCES tenants(id),
  employee_id           UUID NOT NULL REFERENCES employees(id),
  category              VARCHAR(64) NOT NULL, -- letter|data_change|general
  subject               VARCHAR(255) NOT NULL,
  description           TEXT NULL,
  status                VARCHAR(32) NOT NULL DEFAULT 'open',
  approval_instance_id  UUID NULL,
  sla_due_at            TIMESTAMPTZ NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by            UUID NULL,
  updated_by            UUID NULL,
  deleted_at            TIMESTAMPTZ NULL
);
```

### 5.12 Notifications & audit

```sql
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  channel         VARCHAR(32) NOT NULL, -- in_app|email
  template_code   VARCHAR(64) NULL,
  title           VARCHAR(255) NOT NULL,
  body            TEXT NOT NULL,
  payload_json    JSONB NULL,
  status          VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending|sent|failed|read
  read_at         TIMESTAMPTZ NULL,
  sent_at         TIMESTAMPTZ NULL,
  error_message   TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_notifications_user ON notifications(tenant_id, user_id, status, created_at DESC);

CREATE TABLE audit_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id   UUID NULL,
  actor_ip        INET NULL,
  correlation_id  UUID NULL,
  action          VARCHAR(64) NOT NULL,      -- create|update|delete|login|export|approve
  entity_type     VARCHAR(64) NOT NULL,
  entity_id       UUID NULL,
  severity        VARCHAR(16) NOT NULL DEFAULT 'info',
  before_json     JSONB NULL,                -- redacted PII as needed
  after_json      JSONB NULL,
  metadata_json   JSONB NULL
);

CREATE INDEX ix_audit_tenant_time ON audit_events(tenant_id, occurred_at DESC);
CREATE INDEX ix_audit_entity ON audit_events(tenant_id, entity_type, entity_id);
```

**Rule:** `audit_events` has **no** `deleted_at` and **no** update API. Corrections are compensating events.

---

## 6. Constraints & integrity checklist

| Concern | Approach |
|---------|----------|
| Tenant isolation | All FKs within same `tenant_id`; enforce in service layer + composite FK patterns where practical |
| Circular manager | App validation; no self-manager |
| Overlapping leave | App rule + optional exclusion later |
| Locked attendance | `is_locked` prevents edits after payroll batch freeze |
| Document access | AuthZ by role + ownership; signed download URLs |
| CITEXT | Use `citext` extension for emails or normalize to lower-case in app |

---

## 7. Index strategy summary

| Pattern | Example |
|---------|---------|
| Tenant + status | `employees(tenant_id, status)` partial |
| Tenant + natural key | Unique `(tenant_id, employee_code)` |
| Time-range queries | `attendance(tenant_id, attendance_date)` |
| Approval inbox | Future: `approval_actions` pending materialization or stage assignee table |
| Audit forensics | `(tenant_id, occurred_at DESC)`, `(entity_type, entity_id)` |

Avoid over-indexing write-heavy tables until query plans prove need (**Metric-to-measure:** p95 query time on employee list & leave inbox).

---

## 8. Migration & evolution

1. Flyway/Liquibase/TypeORM migrations — choose one in ADR; no manual prod DDL.
2. Expand-contract for breaking changes.
3. `tenant_id` never dropped.
4. When SaaS arrives: RLS policies optional enhancement; app filters remain mandatory.
5. greytHR import staging tables live in a separate `staging` schema (see data migration doc).

---

## 9. Open decisions (must close in Sprint 0)

| ID | Question | Default if undecided |
|----|----------|----------------------|
| DB-01 | ORM vs SQL migrations | Prefer migration files + Nest repositories |
| DB-02 | Employment history table vs versioned rows | Versioned `employments` rows |
| DB-03 | Leave balance ledger | Add in P1 if adjustments frequent |
| DB-04 | RLS in MVP | **No** — app-enforced only |
| DB-05 | PII column encryption | App-level for highly sensitive; TLS in transit |

---

## 10. Exit criteria for Schema v1

- [ ] All P0 entities have tables + FKs + soft-delete policy  
- [ ] `tenant_id` on every business table  
- [ ] Payroll limited to input stub  
- [ ] Audit & notification tables present  
- [ ] Seed script for one tenant + demo org (~20 employees)  
- [ ] Reviewed by Lead Architect + Security owner  

---

*Document owner: Backend Engineer + Lead Architect. Update when ADRs or MVP scope change.*
