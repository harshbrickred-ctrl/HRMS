# 24 — 12-Week Project Plan (Parts 28–31)

**Product:** PeopleOS (internal HRMS)  
**Org:** ~500-employee India IT consultancy; greytHR incumbent  
**Stack:** NestJS + React + PostgreSQL (modular monolith)  
**Team:** 4 engineers · **Window:** 12 weeks · **Sprints:** 2 weeks  
**Committed scope:** **P0 MVP only**  
**Evidence labels:** **Fact** | **Assumption** | **Estimate** | **Metric-to-measure**

**Related:** [25-sprint-plan.md](25-sprint-plan.md) · [appendices/capacity-sheet.md](appendices/capacity-sheet.md) · [23-risk-register.md](23-risk-register.md) · [00-README.md](00-README.md)

---

## Evidence & planning honesty

| Statement | Label |
|-----------|-------|
| 4 engineers × 12 weeks × 5 days = 240 person-days | **Fact** (arithmetic) |
| ~35–40% non-coding → ~145–155 effective | **Estimate** |
| 15% contingency → ~127 commit-able person-days | **Estimate** |
| P0 only is the CEO-committed delivery | **Assumption** until CEO freezes MVP in docs 01/05 |
| greytHR remains payroll system of record for MVP | **Fact** (locked decision in README) |
| No invented ROI / payback | Policy |

---

# PART 28 — Project Team & Responsibilities

## 28.1 Roles

| Role | Short code | Primary focus |
|------|------------|---------------|
| Lead Developer / Solution Architect | **Lead** | Architecture, ADRs, security baseline, cross-cutting design, critical reviews, stakeholder technical interface |
| Backend Engineer | **BE** | NestJS modules, PostgreSQL schema/migrations, domain APIs, workflow engine, integrations |
| Frontend Engineer | **FE** | React ESS / Manager / HR Admin, UX fidelity, accessibility baseline |
| Full-stack / QA Automation | **FS/QA** | CI/CD, Docker, E2E, API/security test suites, migration scripts, pilot deploy ops |

**Assumption:** One person per role; no dedicated Product Manager — Lead + HR stakeholder share BA load.

## 28.2 Responsibility matrix (RACI-lite)

| Workstream | Lead | BE | FE | FS/QA | HR stakeholder |
|------------|------|----|----|-------|----------------|
| MVP freeze / scope control | A | C | C | C | R (business) |
| ADRs / architecture | R/A | C | C | C | I |
| Schema v1 | A | R | C | C | C |
| Auth / RBAC / audit | A | R | C | C | C (roles) |
| Core HR APIs | A | R | C | C | C |
| Leave + workflow | A | R | C | C | R (policy) |
| Attendance | A | R | C | C | C |
| ESS / Manager UI | A | C | R | C | C |
| Documents / notifications / reports | A | R (API) | R (UI) | C | C |
| Testing strategy execution | A | C | C | R | C (UAT) |
| DevOps / Docker / CI | A | C | I | R | I |
| greytHR migration | A | C | I | R | R (data quality) |
| Security review | R/A | C | C | R (tests) | I |
| Training / change | C | I | C | C | R |
| Go / No-Go recommendation | R | C | C | C | C (CEO decides) |

R = Responsible, A = Accountable, C = Consulted, I = Informed.

## 28.3 Ownership (module owners)

| Module (P0) | Code owner | UX owner | Test owner |
|-------------|------------|----------|------------|
| Identity / Auth | Lead + BE | FE | FS/QA |
| RBAC / Permissions | Lead | FE | FS/QA |
| Audit log | BE | — | FS/QA |
| Employee / Org | BE | FE | FS/QA |
| Leave | BE | FE | FS/QA |
| Workflow / Approvals | BE | FE | FS/QA |
| Attendance | BE | FE | FS/QA |
| ESS | FE | FE | FS/QA |
| Manager portal | FE | FE | FS/QA |
| Documents | BE + FE | FE | FS/QA |
| Notifications | BE + FE | FE | FS/QA |
| Reports (P0) | BE + FE | FE | FS/QA |
| Migration tooling | FS/QA | — | FS/QA + HR |
| Deploy / runbooks | FS/QA | — | Lead |

## 28.4 Cross-functional collaboration rules

1. **No orphan APIs:** BE opens PR with OpenAPI stub + FE contract test before UI merges that depend on it (**Assumption**: contract-first within sprint).
2. **Pairing windows:** Lead pairs 2–4 hours/week with each engineer on highest-risk item (**Estimate**).
3. **HR office hours:** 2× weekly 45-minute slots Weeks 1–2 and 5–7 for policy clarification (**Assumption**).
4. **Bottleneck avoidance:** Every module has a secondary (“buddy”) who can merge hotfix PRs.

## 28.5 Code review

| Rule | Detail |
|------|--------|
| Required reviewers | ≥1 other engineer; security-sensitive (auth, RBAC, migration) also needs Lead |
| SLA | First review within 1 business day (**Assumption**) |
| Scope | Correctness, security, tests, migration safety, no silent P0 scope adds |
| Size | Prefer <400 LOC net; larger needs design note in PR |

## 28.6 Testing ownership

| Layer | Primary | Secondary |
|-------|---------|-----------|
| Unit (domain) | Author of code | Buddy |
| API / integration | BE | FS/QA |
| UI component | FE | FS/QA |
| E2E critical paths | FS/QA | FE |
| Security scans / smoke | FS/QA | Lead |
| UAT scripts | FS/QA + HR | Lead |

Detail: [16-testing-strategy.md](16-testing-strategy.md).

## 28.7 Documentation ownership

| Artifact | Owner |
|----------|-------|
| ADRs | Lead |
| API / schema deltas | BE |
| UX / screen map | FE |
| Test reports / evidence | FS/QA |
| Runbooks / deploy | FS/QA |
| Training / adoption | HR + Lead |
| Risk register updates | Lead |

## 28.8 Architecture participation

All four engineers attend ADR reviews for ADRs 001–010 before Week 3 coding of foundation. Deferred ADRs may be written in-sprint but must not reopen locked stack decisions (NestJS / React / PostgreSQL / modular monolith / no payroll engine).

---

# PART 29 — 12-Week Implementation Plan

**Calendar structure (**Fact** of plan):** Weeks 1–2 discovery; 3–4 foundation; 5–7 Core HR + Leave + Workflow; 8 Attendance; 9–10 ESS/Manager/Documents/Notifications/Reports; 11 Security/UAT/migration dry-run; 12 Pilot go-live/training.

**Deviation from naive “Weeks 5–8 all core”:** Attendance isolated to Week 8 so Leave+Workflow land first (**Assumption**: leave approvals are higher business pain than attendance for this consultancy).

### Global Definition of Done (all weeks)

A week is Done only when:

1. Listed P0 objectives met or explicitly deferred with Lead+HR written approval.
2. Automated tests for new/changed code merged (per [16-testing-strategy.md](16-testing-strategy.md) gates).
3. Docs/ADRs updated if behavior or contracts changed.
4. No Sev-1 open defects on that week’s features.
5. Demoable on shared Dev/QA Compose stack.

---

## Week 1 — Discovery kickoff & market-informed MVP freeze

| Field | Content |
|-------|---------|
| **Objectives** | Confirm CEO/HR problems; freeze P0 vs P1/P2; start greytHR export inventory; UX research for ESS/Manager/HR |
| **Features** | None shipping — product definition |
| **Dev tasks** | Repo bootstrap skeleton (optional); doc pack walkthrough; competitor gap → MVP matrix |
| **Architecture** | Draft ADR backlog; confirm modular monolith boundaries |
| **Testing** | Define critical UAT personas & journeys (draft) |
| **Documentation** | PRD outline; FR ID conventions; risk draft |
| **Dependencies** | CEO availability; HR export access; greytHR admin |
| **Owners** | Lead (A), all C; HR R for data access |
| **DoD** | Written P0 list signed by Lead+HR; greytHR export types listed; week-2 agenda locked |

---

## Week 2 — PRD, UX, ADRs, schema v1, greytHR discovery deep-dive

| Field | Content |
|-------|---------|
| **Objectives** | Complete Sprint 0 artifacts; schema v1 draft; mapping workbook started |
| **Features** | Wireframes for ESS home, leave request, manager approve, HR employee profile |
| **Dev tasks** | ERD / migration zero; OpenAPI skeleton; Docker Compose draft |
| **Architecture** | ADRs 001–010 draft/approve (stack, tenancy column, auth, audit, files, CI) |
| **Testing** | Traceability matrix template FR → story → test |
| **Documentation** | 05 PRD MVP; 09 UX; 12 schema; 21 migration discovery notes |
| **Dependencies** | Week 1 freeze; sample greytHR Excel/CSV |
| **Owners** | Lead+BE schema; FE UX; FS/QA Compose+CI spike; HR data samples |
| **DoD** | ADRs approved; schema v1 review complete; UX for P0 flows approved for build; Sprint 1 backlog ready |

---

## Week 3 — Foundation: identity, project infra

| Field | Content |
|-------|---------|
| **Objectives** | Runnable Compose app; auth login/logout/session; CI on PR |
| **Features** | Login; password change (MVP); session expiry; health endpoints |
| **Dev tasks** | NestJS app modules shell; React app shell; PostgreSQL migrations pipeline; GitHub Actions workflow (free tier) |
| **Architecture** | Auth ADR final; secrets via env; audit table stub |
| **Testing** | Auth unit + API tests; CI green path |
| **Documentation** | 22 local deploy section; 17 branching rules |
| **Dependencies** | Schema v1; ADRs |
| **Owners** | Lead+BE auth; FS/QA CI/Docker; FE login UI |
| **DoD** | New engineer can `compose up` and log in; PR cannot merge red CI |

---

## Week 4 — RBAC, audit, harden foundation

| Field | Content |
|-------|---------|
| **Objectives** | Role-permission enforcement; audit write path; seed roles |
| **Features** | Roles: Employee, Manager, HR Admin, System Admin (MVP set — **Assumption**); permission checks on APIs; audit viewer for HR Admin (read) |
| **Dev tasks** | Guards/policies; permission seed; FE route guards; structured logging |
| **Architecture** | RBAC model frozen for MVP; tenant_id column present |
| **Testing** | Negative authz tests; audit integration tests |
| **Documentation** | Permission matrix; security baseline checklist start |
| **Dependencies** | Week 3 auth |
| **Owners** | Lead (matrix), BE (enforcement), FE (guards), FS/QA (neg tests) |
| **DoD** | Forbidden role cannot call privileged API (automated); audit row on mutate |

---

## Week 5 — Core HR (employee & org)

| Field | Content |
|-------|---------|
| **Objectives** | Employee master CRUD (HR); org units; manager assignment; employment status |
| **Features** | Create/update employee; list/search; org tree (flat/hierarchy MVP); soft status Active/Inactive |
| **Dev tasks** | Domain module Employees/Org; validation; FE HR screens |
| **Architecture** | Bounded context Core HR; ID strategy |
| **Testing** | API CRUD + uniqueness (employee code/email); UI smoke |
| **Documentation** | FR updates; sample data guide |
| **Dependencies** | RBAC |
| **Owners** | BE+FE; FS/QA tests; HR validates fields vs greytHR |
| **DoD** | HR can maintain employee record end-to-end on QA; field map to greytHR documented |

---

## Week 6 — Leave policies & requests

| Field | Content |
|-------|---------|
| **Objectives** | Leave types/policies; balances; employee request; cancel draft |
| **Features** | Policy config (HR); balance ledger; request submit; list own requests |
| **Dev tasks** | Leave domain; balance calculations; FE ESS leave + HR policy screens |
| **Architecture** | Ledger immutability rules; timezone IST (**Assumption**) |
| **Testing** | Balance edge cases; overlapping leave rules |
| **Documentation** | Business rules; UAT scripts draft |
| **Dependencies** | Employee master; RBAC |
| **Owners** | BE leave engine; FE screens; HR policy sign-off; FS/QA |
| **DoD** | Happy-path leave request with correct balance deduction in QA |

---

## Week 7 — Approval workflow

| Field | Content |
|-------|---------|
| **Objectives** | Configurable simple approval for leave (manager → optional HR); notifications stub |
| **Features** | Approve/reject; comments; escalation timeout **deferred** if capacity tight (**Estimate**) |
| **Dev tasks** | Workflow engine MVP (state machine); manager inbox API/UI |
| **Architecture** | Workflow generic enough for future requests without building all request types |
| **Testing** | Multi-role approval paths; unauthorized approve blocked |
| **Documentation** | State diagrams; FR |
| **Dependencies** | Leave; manager assignment |
| **Owners** | BE workflow; FE manager inbox; FS/QA E2E leave approve |
| **DoD** | E2E: employee requests → manager approves → balance finalized; audit complete |

---

## Week 8 — Attendance

| Field | Content |
|-------|---------|
| **Objectives** | Attendance records MVP; manual entry and/or CSV import; manager/HR view |
| **Features** | Daily attendance status; correction request **P1 if cut**; reports seed |
| **Dev tasks** | Attendance module; import job; FE timesheets/attendance views |
| **Architecture** | Idempotent import; link to employee codes |
| **Testing** | Import validation; duplicate day handling |
| **Documentation** | Import template; reconciliation notes |
| **Dependencies** | Employee master; authz |
| **Owners** | BE+FS/QA import; FE views; HR template |
| **DoD** | Import 1 month sample for pilot cohort without silent duplicates |

---

## Weeks 9–10 — ESS, Manager, Documents, Notifications, Reports

### Week 9

| Field | Content |
|-------|---------|
| **Objectives** | ESS shell polished; profile view; leave+attendance self views; manager dashboard MVP |
| **Features** | ESS home; my profile (read/limited edit per policy); manager team list; pending approvals |
| **Dev tasks** | FE composition; API gaps closed; a11y pass on critical screens |
| **Testing** | E2E ESS+Manager paths; a11y checks on P0 screens |
| **Owners** | FE primary; BE API completion; FS/QA E2E |
| **DoD** | Pilot personas can complete top 5 journeys without HR intervention |

### Week 10

| Field | Content |
|-------|---------|
| **Objectives** | Documents metadata+upload; in-app notifications; P0 reports |
| **Features** | Upload/list/download with RBAC; notification center; reports: headcount, leave balance, attendance summary (**Assumption** P0 report set) |
| **Dev tasks** | File storage local/MinIO-dev; notification table; report queries |
| **Architecture** | File ADR; no public buckets |
| **Testing** | Authz on documents; report accuracy vs seed |
| **Owners** | BE files/reports; FE UX; FS/QA security tests |
| **DoD** | Document access denied for wrong role (automated); 3 P0 reports signed off by HR on sample data |

---

## Week 11 — Security, UAT, migration dry-run

| Field | Content |
|-------|---------|
| **Objectives** | Security hardening; full UAT cycle; migration dry-run #1–2; defect burn-down |
| **Features** | Freeze net-new P0 features unless Sev-1 gap |
| **Dev tasks** | Patch findings; performance smoke; backup/restore drill |
| **Architecture** | Threat review vs 14-security |
| **Testing** | UAT; regression; SAST/secret scan; penetration **lightweight** checklist (**Estimate**: checklist not full pentest) |
| **Documentation** | UAT evidence; Go/No-Go draft; known issues |
| **Dependencies** | Feature complete P0; cleansed migration files |
| **Owners** | FS/QA+Lead security; HR UAT; FS/QA migration |
| **DoD** | UAT exit criteria met or waivers documented; dry-run reconciliation within agreed tolerance |

---

## Week 12 — Pilot go-live & training

| Field | Content |
|-------|---------|
| **Objectives** | Pilot cohort live on internal host; training delivered; hypercare staffing |
| **Features** | Production config for pilot; monitoring/alerts MVP; rollback verified |
| **Dev tasks** | Cutover; smoke; support rota |
| **Testing** | Post-go-live smoke; data spot checks |
| **Documentation** | Runbook final; training decks; 30/60/90 plan active |
| **Dependencies** | Go criteria; backups; HR communications |
| **Owners** | Lead+FS/QA cutover; HR training; all on hypercare |
| **DoD** | Pilot users authenticating; critical journeys green; Go recorded; rollback package retained |

---

## Critical path

```text
CEO/HR P0 freeze → ADRs+Schema v1 → Auth → RBAC/Audit
        → Employee master → Leave → Workflow
        → Attendance (after employee codes stable)
        → ESS/Manager UX → Documents/Notifications/Reports
        → Migration dry-run → UAT → Pilot cutover
```

**Parallelizable:** FE UX implementation once contracts stable; CI/Docker with foundation; migration cleansing with HR from Week 2 onward (business path, not only engineering).

**Single points of failure:** Schema mistakes (Lead+BE), greytHR data quality (HR), free-tier CI outage (FS/QA local fallback).

---

# PART 30 — Sprint Plan (summary)

Full detail in [25-sprint-plan.md](25-sprint-plan.md).

| Sprint | Weeks | Goal (one line) |
|--------|-------|-----------------|
| Sprint 0 | 1–2 | Discovery, PRD, UX, ADRs, schema, greytHR discovery, backlog |
| Sprint 1 | 3–4 | Foundation: auth, RBAC, audit, Docker, CI |
| Sprint 2 | 5–6 | Core HR + Leave |
| Sprint 3 | 7–8 | Workflow + Attendance |
| Sprint 4 | 9–10 | ESS/Manager + Docs/Notifications/Reports |
| Sprint 5 | 11 | Security, UAT, migration dry-run, harden |
| Sprint 6 | 12 | Pilot go-live, training, hypercare start |

*Note:* Sprint 5–6 are each one calendar week aligned to the week plan (or treat Week 11–12 as a single “release sprint” with mid-checkpoint). This pack models **Sprint 5 = Week 11**, **Sprint 6 = Week 12** for exit clarity; capacity math still uses 12 weeks.

---

# PART 31 — Estimation & Capacity

## 31.1 Headline numbers

| Metric | Value | Label |
|--------|-------|-------|
| Gross capacity | 240 person-days | **Fact** |
| Overhead | 35–40% | **Estimate** |
| Effective | 145–155 person-days | **Estimate** |
| Contingency | 15% ≈ 22–23 days | **Estimate** |
| Commit-able P0 | ~127 person-days | **Estimate** |

Detail breakdown: [appendices/capacity-sheet.md](appendices/capacity-sheet.md).

## 31.2 Estimation method

| Technique | Use |
|-----------|-----|
| Developer-days | Primary for capacity fit |
| Complexity S/M/L | Backlog grooming |
| Story points (optional) | Team velocity after Sprint 1 — **do not** invent velocity before data |
| Dependencies | Explicit on critical path items |

**Avoid false precision:** Prefer ranges; re-estimate at each sprint planning.

## 31.3 Contingency policy

| Consume contingency for | Do not consume for |
|-------------------------|-------------------|
| Migration data defects | New P1 features |
| UAT Sev-1/2 fixes | Payroll engine experiments |
| Security findings | Premature Azure migration |
| Sick leave / urgent prod | Nice-to-have polish |

## 31.4 Scope control trigger

If forecasted remaining P0 work > remaining commit-able + contingency at any Friday checkpoint → **mandatory scope cut meeting** (Lead + HR + CEO delegate) within 2 business days.

---

## Week → Owner cheat sheet

| Week | Lead | BE | FE | FS/QA |
|------|------|----|----|-------|
| 1–2 | A discovery/ADRs | Schema | UX | Compose/CI spike, migration discovery |
| 3–4 | Authz design | Auth/RBAC/API | Login/guards | CI, Docker, audit tests |
| 5–7 | Reviews | HR/Leave/Workflow | HR+ESS leave UI | API/E2E |
| 8 | Reviews | Attendance | Attendance UI | Import tests |
| 9–10 | Reviews | Files/reports API | ESS/Manager/Docs | E2E/a11y |
| 11 | Security/Go draft | Defects | Defects | UAT, dry-run |
| 12 | Cutover A | Support | Support | Deploy, smoke |

---

*Parts 28–31 complete. Sprint-level stories and demos: document 25.*
