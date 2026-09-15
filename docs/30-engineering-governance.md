# 30 — Engineering Governance

**Product:** PeopleOS  
**Audience:** Engineering team, Tech Lead, QA  
**Stack:** NestJS + React + PostgreSQL modular monolith  
**Related:** [16-testing-strategy.md](16-testing-strategy.md), [17-devops-strategy.md](17-devops-strategy.md), [13-api-specification.md](13-api-specification.md), [26-adrs/](26-adrs/)

---

## 1. Purpose

Keep a 4-person team fast **and** safe on an HR system that holds PII. Governance is lightweight but mandatory — no ceremony for its own sake.

---

## 2. Coding standards

### General

- Language: TypeScript strict mode (API + web).
- No `any` without justification comment; prefer `unknown` + narrow.
- Prefer small pure functions for domain rules; keep controllers thin.
- Feature folders / Nest modules by bounded context (Identity, CoreHR, Leave, Attendance, Workflow, Documents, Reporting).
- Shared kernel only for cross-cutting (auth guards, logging, tenant context) — avoid a dumping-ground `utils`.

### Backend (NestJS)

- DTO validation on every input boundary.
- Domain errors mapped to HTTP via exception filters (see §6).
- Transactions for multi-table writes (leave submit + balance + approval).
- Never concatenate SQL; parameterized queries / ORM API only.
- `tenant_id` from auth context on every query.

### Frontend (React)

- Functional components; accessible forms (labels, errors, focus).
- No secrets in frontend bundles.
- API client centralizes auth header + correlation ID.
- Route-level code splitting for HR vs ESS where beneficial.

### Style / lint

- ESLint + Prettier enforced in CI.
- PR must be lint-clean; no “fix later” on main.

---

## 3. Git branching

| Branch | Purpose |
|--------|---------|
| `main` | Always releasable; protected |
| `develop` (optional) | Integration if team prefers; else trunk-based on `main` with short PRs |
| `feature/<ticket>-short-name` | Feature work |
| `fix/<ticket>-short-name` | Bugfix |
| `chore/<topic>` | Tooling, deps |
| `hotfix/<ticket>-short-name` | Prod emergency from `main` |

**Recommendation for 4 people:** Trunk-based development on `main` with small PRs (<400 LOC ideal). Use `develop` only if release trains require it.

### Commits

- Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
- Imperative mood; reference ticket ID.
- No secrets in history; rotate immediately if leaked.

---

## 4. Pull requests & reviews

| Rule | Detail |
|------|--------|
| PR size | Prefer vertical slices; split large features |
| Reviewers | ≥1 approval; Lead reviews architecture-sensitive changes |
| CI | Lint, unit, build must pass before merge |
| Security-sensitive | AuthZ, documents, exports → explicit security checklist |
| Do not merge | Failing tests, unresolved “request changes”, TODO left for P0 paths |

### Review checklist (abbreviated)

- [ ] Correct permission checks / object-level auth  
- [ ] tenant isolation preserved  
- [ ] Soft-delete & audit considered  
- [ ] Errors use envelope; no stack traces to client  
- [ ] Migrations reversible or expand-contract safe  
- [ ] Tests for happy + critical negative path  

---

## 5. Definition of Ready (DoR)

A backlog item is Ready when:

1. User story + acceptance criteria written  
2. UX noted (wireframe or explicit “API only”)  
3. Permissions identified  
4. Dependencies clear (API contract, migration)  
5. Out of scope stated  
6. Test notes (what QA will verify)  
7. Sized within one sprint for the assignee  

If DoR fails → item stays in backlog refinement.

---

## 6. Definition of Done (DoD)

A story is Done when:

1. Code merged to `main` via PR  
2. Unit/integration tests for acceptance criteria  
3. Migration applied in DEV; documented  
4. Observability: meaningful logs + correlation ID on path  
5. Audit events for sensitive mutations  
6. OpenAPI updated if API changed  
7. Feature flag / config documented if any  
8. QA sign-off on acceptance criteria  
9. No new critical linter/security findings  
10. Docs touched if behavior is user-visible (changelog or module README)  

---

## 7. Logging

| Level | Use |
|-------|-----|
| `error` | Failures needing action |
| `warn` | Degraded / retry / authZ deny spikes |
| `info` | Request completed, job lifecycle |
| `debug` | Local/dev only; not default in prod |

**Always include:** `correlationId`, `tenantId`, `userId` (if any), `route`, `durationMs`.  
**Never log:** passwords, tokens, full PAN/Aadhaar, raw document contents. Redact PII in `before_json`/`after_json` audit where required.

---

## 8. Exceptions

- Domain: `LeaveBalanceInsufficientError`, `ConflictError`, etc.  
- Map to stable `error.code` strings (see API spec).  
- Unexpected exceptions → `500` + generic message; full detail only in logs.  
- Do not use exceptions for normal control flow in hot paths.

---

## 9. API standards

Follow [13-api-specification.md](13-api-specification.md):

- `/api/v1`, error envelope, pagination, Idempotency-Key where required  
- OpenAPI regenerated in CI artifact  
- Breaking changes require ADR + version bump discussion  

---

## 10. Database standards

Follow [12-database-design.md](12-database-design.md):

- Migrations only — no manual prod DDL  
- `tenant_id` on business tables  
- Soft delete + partial unique indexes  
- Indexes reviewed with EXPLAIN for new hot queries  
- Seed data for local demo; never prod dumps in git  

---

## 11. Security standards

- Threats in mind: BOLA, IDOR, upload malware, privilege escalation, PII leakage  
- Secrets in env/Key Vault — never committed  
- Dependency scanning in CI  
- MFA for privileged roles when available  
- Least privilege DB roles (app vs migration)  
- File downloads via short-lived signed URLs / controlled stream  
- Exit checklist: disable user same day as HR exit  

---

## 12. Testing standards

| Layer | Expectation |
|-------|-------------|
| Unit | Domain rules (leave, employment dates) |
| Integration | API + DB (testcontainers or docker compose) |
| E2E | Critical paths: login, leave approve, attendance export |
| Security | Negative authZ tests mandatory for employee-scoped resources |
| Performance | Smoke on list endpoints before hardening phase |

Coverage target is **risk-based**, not vanity % — critical domains first.

---

## 13. Documentation standards

- ADRs for irreversible/stack decisions  
- Module README for local run  
- Update OpenAPI + this governance only when process changes  
- CEO/product docs owned separately; eng must not invent ROI numbers  

---

## 14. SDLC phase table (Part 8 condensed)

| Phase | Objective | Activities | Deliverables | Owners | Exit criteria |
|-------|-----------|------------|--------------|--------|---------------|
| **Discovery** | Confirm problems & MVP freeze | Stakeholder interviews; greytHR gap workshop; process mapping | Problem statements; MVP P0/P1 list; assumptions log | Product/BA + HR Head + Lead | Written MVP freeze signed by HR + Lead |
| **Requirements** | Spec buildable scope | FR/NFR IDs; stories; flows; UX wireframes | PRD/SRS; story map; UX for ESS/Manager/HR | Product + Frontend | DoR met for Sprint 1 backlog |
| **Architecture** | Lock technical direction | ADRs 001–010; schema v1; API standards; security baseline | Architecture docs; ERD; threat model lite | Lead + Backend | ADRs accepted; Schema v1 review passed |
| **Sprint 0 / Setup** | Tooling ready | Repo, CI, Docker Compose, lint, seed tenant | Running empty app skeleton; pipeline green | Full team | “Hello secure API + login shell” demo |
| **Implementation** | Deliver P0 in 12 weeks | Vertical slices; code review; continuous test | Working modules per sprint plan | All eng | Sprint goals met; burndown healthy |
| **Verification** | Prove quality | Test packs; UAT with HR; security checks | Test report; UAT sign-off; known issues list | QA/Full-stack + HR | UAT pass on P0; no open Sev-1 |
| **Deployment** | Go-live internal | Migration; backup; training; hypercare plan | Deployment guide executed; runbook | Lead + Ops assignee | Production checklist complete |
| **Post-launch** | Stabilize & learn | Hypercare; KPI baselines; debt triage; SaaS gate decision | KPI baseline sheet; retro; Phase 2 proposal | Product + Lead | Baselines recorded; G2 decision scheduled |

---

## 15. Roles (governance RACI lite)

| Concern | Lead | Backend | Frontend | Full-stack/QA |
|---------|------|---------|----------|---------------|
| Architecture ADRs | A/R | C | C | I |
| Schema & API | A | R | C | C |
| UX ESS/Manager | C | I | R | C |
| Test strategy | A | C | C | R |
| Security baseline | A/R | R | C | C |
| Release | A | R | R | R |

R=Responsible A=Accountable C=Consulted I=Informed

---

## 16. Non-negotiables

1. No payroll statutory engine in MVP.  
2. No production deploy without backup + rollback plan.  
3. No “temporary” disable of authZ checks on main.  
4. No customer SaaS billing work before Gate G3.  
5. No invented business ROI in engineering docs.  

---

*Owner: Lead Developer / Solution Architect. Review with team at Sprint 0; revise only via PR.*
