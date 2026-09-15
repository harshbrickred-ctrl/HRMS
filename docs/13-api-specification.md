# 13 — API Specification

**Product:** PeopleOS  
**Style:** REST JSON over HTTPS  
**Base path:** `/api/v1`  
**Stack:** NestJS controllers + DTOs + class-validator  
**Audience:** Backend, frontend, integrators  
**Related:** [12-database-design.md](12-database-design.md), [14-security-architecture.md](14-security-architecture.md)

---

## 1. Goals

- Stable, versioned HTTP API for web ESS/Manager/HR clients.
- Predictable pagination, filtering, sorting, and errors.
- Safe for future multi-tenant SaaS and partner integrations.
- OpenAPI 3.1 as source of truth generated from NestJS decorators.

**Non-goals (MVP):** GraphQL, public partner marketplace, SCIM, webhooks (roadmap Phase 3+).

---

## 2. REST standards

### 2.1 Versioning

| Rule | Detail |
|------|--------|
| URI versioning | All routes under `/api/v1/...` |
| Breaking change | New major (`/api/v2`); no silent breaks in v1 |
| Non-breaking | Additive fields, new optional query params, new endpoints OK in v1 |
| Deprecation | `Deprecation` + `Sunset` headers when retiring |

### 2.2 Resource naming

- Plural nouns: `/employees`, `/leave-requests`.
- kebab-case path segments.
- Nested only when ownership is clear: `/employees/{id}/documents`.
- Prefer flat + filter for cross-cutting lists: `/leave-requests?employeeId=`.

### 2.3 HTTP methods

| Method | Use |
|--------|-----|
| `GET` | Read; safe; idempotent |
| `POST` | Create or non-idempotent action |
| `PUT` | Full replace (rare) |
| `PATCH` | Partial update |
| `DELETE` | Soft-delete unless purge endpoint (admin) |

Actions as sub-resources: `POST /leave-requests/{id}/submit`, `/approve`, `/reject`, `/cancel`.

### 2.4 Content types

- Request/response: `application/json; charset=utf-8`
- Multipart for uploads: `multipart/form-data`
- Exports: `text/csv` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Prefer ISO-8601 timestamps (`2026-09-14T10:15:00+05:30`) and `YYYY-MM-DD` dates

### 2.5 Correlation IDs

| Header | Direction | Rule |
|--------|-----------|------|
| `X-Correlation-Id` | Client → API | Optional; if absent, server generates UUID |
| `X-Correlation-Id` | API → Client | Always echoed |
| `X-Request-Id` | API → Client | Unique per request (may equal correlation) |

Propagate into logs, audit events, and async jobs.

### 2.6 Authentication & authorization

| Aspect | MVP standard |
|--------|--------------|
| AuthN | Bearer JWT (access) + refresh token (httpOnly cookie or secure storage policy) |
| Header | `Authorization: Bearer <access_token>` |
| Tenant | Derived from token claim `tid`; **never** trust client-supplied `tenantId` for authZ |
| AuthZ | RBAC permissions checked per endpoint; object-level checks for employee-owned data |
| MFA | Supported at login for privileged roles (HR/Admin) |

Unauthorized → `401`; Forbidden → `403` (do not leak existence of other employees’ resources where avoidable).

### 2.7 Idempotency

| Endpoint class | Mechanism |
|----------------|-----------|
| `POST` creates that may retry | `Idempotency-Key` header (UUID); store hash of response for 24h |
| Approvals / exports | Idempotency-Key or natural uniqueness (one open batch per period) |
| `GET`/`PUT`/`PATCH`/`DELETE` | Naturally idempotent at protocol level (soft-delete twice → 404 or same state) |

### 2.8 Rate limiting

| Scope | MVP guidance |
|-------|--------------|
| Authenticated user | e.g. 300 req/min (**Estimate** — tune after load) |
| Login / password reset | Stricter (e.g. 10/min/IP) |
| Export / report | Lower concurrency |
| Response headers | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After` on `429` |

### 2.9 Pagination

Cursor or offset — **MVP chooses offset** for simplicity; design DTOs so cursor can replace later.

```http
GET /api/v1/employees?page=1&pageSize=25
```

```json
{
  "data": [ /* items */ ],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 512,
    "totalPages": 21
  }
}
```

Limits: `pageSize` max 100 (reports may use dedicated export endpoints).

### 2.10 Filtering, sorting, search

| Feature | Convention |
|---------|------------|
| Filter | Query params: `status=active&departmentId={uuid}` |
| Date range | `from=2026-09-01&to=2026-09-30` |
| Sort | `sort=lastName:asc,dateOfJoining:desc` (whitelist fields) |
| Search | `q=` full-text-ish on name/code/email (ILIKE / trigram later) |
| Sparse fieldsets | Optional later; not MVP |

Unknown sort/filter fields → `400` with validation error.

### 2.11 Validation

- DTO validation via `class-validator` / Zod at boundary.
- Fail fast with field-level errors.
- Business rule failures → `422` or domain `409` as appropriate.

### 2.12 Error envelope

All errors use a single envelope:

```json
{
  "error": {
    "code": "LEAVE_BALANCE_INSUFFICIENT",
    "message": "Requested leave exceeds available balance.",
    "correlationId": "8f3c2a1e-6b4d-4c9a-9e21-1a2b3c4d5e6f",
    "details": [
      {
        "field": "days",
        "issue": "requested 3.0, available 1.5"
      }
    ]
  }
}
```

| HTTP | When |
|------|------|
| `400` | Malformed request / validation |
| `401` | Missing/invalid auth |
| `403` | Authenticated but not permitted |
| `404` | Resource not found (in tenant) |
| `409` | Conflict (duplicate code, overlapping leave) |
| `422` | Semantic business rule failure |
| `429` | Rate limited |
| `500` | Unexpected; message generic; detail in logs only |

### 2.13 OpenAPI

- Generate OpenAPI 3.1 from NestJS (`@nestjs/swagger`).
- Publish `/api/docs` in non-prod; protect or disable in prod.
- Tag by domain: Auth, Employees, Leave, Attendance, Workflows, Documents, Reports.
- Every endpoint documents: auth, permissions, request/response schemas, error codes.

---

## 3. Common headers (summary)

| Header | Required | Notes |
|--------|----------|-------|
| `Authorization` | Yes (except auth/public) | Bearer JWT |
| `Content-Type` | For body | `application/json` |
| `X-Correlation-Id` | Optional | Client-generated |
| `Idempotency-Key` | Selected POSTs | UUID |
| `Accept-Language` | Optional | Future i18n; MVP `en-IN` |

---

## 4. Representative endpoints

### 4.1 Auth

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/api/v1/auth/login` | Email/password → tokens | Public |
| `POST` | `/api/v1/auth/refresh` | Rotate access token | Refresh |
| `POST` | `/api/v1/auth/logout` | Revoke refresh | Auth |
| `GET` | `/api/v1/auth/me` | Current user + roles + employee link | Auth |
| `POST` | `/api/v1/auth/password-reset/request` | Start reset | Public + rate limit |
| `POST` | `/api/v1/auth/password-reset/confirm` | Complete reset | Public + token |

**Example login response (shape):**

```json
{
  "data": {
    "accessToken": "<jwt>",
    "expiresIn": 900,
    "tokenType": "Bearer",
    "user": {
      "id": "...",
      "email": "alex@company.in",
      "displayName": "Alex Kumar",
      "roles": ["employee"],
      "employeeId": "..."
    }
  }
}
```

### 4.2 Employees (Core HR)

| Method | Path | Description | Permission (illustrative) |
|--------|------|-------------|---------------------------|
| `GET` | `/api/v1/employees` | List/search | `employees:read` |
| `GET` | `/api/v1/employees/{id}` | Profile | self or `employees:read` |
| `POST` | `/api/v1/employees` | Create | `employees:write` |
| `PATCH` | `/api/v1/employees/{id}` | Update | `employees:write` |
| `POST` | `/api/v1/employees/{id}/exit` | Start exit | `employees:write` |
| `GET` | `/api/v1/employees/{id}/employment-history` | Effective-dated history | `employees:read` |
| `GET` | `/api/v1/departments` | Org units | authenticated |
| `GET` | `/api/v1/designations` | Titles | authenticated |
| `GET` | `/api/v1/locations` | Locations | authenticated |

**List query examples:**  
`?status=active&departmentId=&q=kumar&sort=lastName:asc&page=1&pageSize=25`

### 4.3 Leave

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/leave-policies` | Active policies |
| `GET` | `/api/v1/leave-balances/me` | My balances |
| `GET` | `/api/v1/leave-balances?employeeId=` | HR/manager view |
| `GET` | `/api/v1/leave-requests` | Filtered inbox/history |
| `POST` | `/api/v1/leave-requests` | Create draft/submit |
| `GET` | `/api/v1/leave-requests/{id}` | Detail |
| `POST` | `/api/v1/leave-requests/{id}/submit` | Submit for approval |
| `POST` | `/api/v1/leave-requests/{id}/cancel` | Cancel if allowed |
| `POST` | `/api/v1/leave-requests/{id}/approve` | Approver action |
| `POST` | `/api/v1/leave-requests/{id}/reject` | Approver action |

`approve`/`reject` require manager/HR permission and open approval stage; use `Idempotency-Key`.

### 4.4 Attendance

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/attendance` | Query by employee/date range |
| `GET` | `/api/v1/attendance/me` | My month view |
| `POST` | `/api/v1/attendance` | Upsert manual entry (HR) |
| `PATCH` | `/api/v1/attendance/{id}` | Correction if unlocked |
| `POST` | `/api/v1/attendance/import` | CSV import job |
| `GET` | `/api/v1/shifts` | Shift catalog |
| `GET` | `/api/v1/holidays` | Holiday calendar |
| `POST` | `/api/v1/payroll-inputs/batches` | Open period batch |
| `POST` | `/api/v1/payroll-inputs/batches/{id}/freeze` | Lock attendance feed |
| `POST` | `/api/v1/payroll-inputs/batches/{id}/export` | CSV/XLSX for greytHR |

### 4.5 Workflows & HR requests

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/workflows/definitions` | Published definitions |
| `GET` | `/api/v1/approvals/inbox` | Pending for current user |
| `GET` | `/api/v1/approvals/{id}` | Instance detail + history |
| `POST` | `/api/v1/approvals/{id}/actions` | approve/reject/delegate |
| `GET` | `/api/v1/hr-requests` | List tickets |
| `POST` | `/api/v1/hr-requests` | Create request |
| `GET` | `/api/v1/hr-requests/{id}` | Detail |
| `PATCH` | `/api/v1/hr-requests/{id}` | Update / resolve (HR) |

### 4.6 Documents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/employees/{id}/documents` | List metadata |
| `POST` | `/api/v1/employees/{id}/documents` | Upload (multipart) |
| `GET` | `/api/v1/documents/{id}` | Metadata |
| `GET` | `/api/v1/documents/{id}/download` | Short-lived signed URL or stream |
| `DELETE` | `/api/v1/documents/{id}` | Soft-delete if not legal hold |

Download must audit `action=download`. Never return permanent public blob URLs.

### 4.7 Reports

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/reports/headcount` | Snapshot by dept/location |
| `GET` | `/api/v1/reports/attrition` | Exits in range |
| `GET` | `/api/v1/reports/leave-utilization` | By policy/dept |
| `GET` | `/api/v1/reports/attendance-summary` | Period summary |
| `POST` | `/api/v1/reports/exports` | Async export job |
| `GET` | `/api/v1/reports/exports/{jobId}` | Job status + download |

Heavy reports are async; sync endpoints must be bounded by date range.

### 4.8 Notifications (supporting)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/notifications` | My notifications |
| `POST` | `/api/v1/notifications/{id}/read` | Mark read |
| `POST` | `/api/v1/notifications/read-all` | Mark all read |

---

## 5. Example success & error flows

### Create leave request

```http
POST /api/v1/leave-requests HTTP/1.1
Authorization: Bearer eyJ...
Content-Type: application/json
Idempotency-Key: 7c9e6679-7425-40de-944b-e07fc1f90ae7
X-Correlation-Id: 8f3c2a1e-6b4d-4c9a-9e21-1a2b3c4d5e6f

{
  "leavePolicyId": "a1...",
  "startDate": "2026-10-02",
  "endDate": "2026-10-03",
  "days": 2,
  "reason": "Family function",
  "submit": true
}
```

```http
HTTP/1.1 201 Created
X-Correlation-Id: 8f3c2a1e-6b4d-4c9a-9e21-1a2b3c4d5e6f
Location: /api/v1/leave-requests/b2...
```

```json
{
  "data": {
    "id": "b2...",
    "status": "pending",
    "days": 2,
    "approvalInstanceId": "c3..."
  }
}
```

### Insufficient balance

```http
HTTP/1.1 422 Unprocessable Entity
X-Correlation-Id: 8f3c2a1e-6b4d-4c9a-9e21-1a2b3c4d5e6f
```

```json
{
  "error": {
    "code": "LEAVE_BALANCE_INSUFFICIENT",
    "message": "Requested leave exceeds available balance.",
    "correlationId": "8f3c2a1e-6b4d-4c9a-9e21-1a2b3c4d5e6f",
    "details": [
      { "field": "days", "issue": "requested 2.0, available 0.5" }
    ]
  }
}
```

---

## 6. Security rules for API implementers

1. Enforce tenant from token on every query.
2. Check object-level auth (BOLA prevention) — employee A cannot read employee B docs without role.
3. Strip sensitive fields by role (DOB, personal email, documents).
4. Validate upload MIME + size; store outside web root.
5. Log authZ denials with correlation ID.
6. No stack traces in client error bodies.

---

## 7. NestJS module mapping (guidance)

| API tag | Nest module |
|---------|-------------|
| Auth | `IdentityModule` |
| Employees / org | `CoreHrModule` |
| Leave | `LeaveModule` |
| Attendance / payroll input | `AttendanceModule` |
| Workflows / HR requests | `WorkflowModule` |
| Documents | `DocumentModule` |
| Reports | `ReportingModule` |
| Notifications | `NotificationModule` |

Controllers stay thin; domain services own rules; repositories own SQL.

---

## 8. Definition of Done for API v1 surface

- [ ] OpenAPI published in DEV  
- [ ] Error envelope consistent  
- [ ] Correlation ID middleware  
- [ ] Pagination on all list endpoints  
- [ ] Integration tests for authZ negative cases  
- [ ] Rate limit on login  
- [ ] Idempotency on leave submit & payroll export  

---

*Owner: Backend Engineer. Review: Lead Architect + Frontend for contract stability.*
