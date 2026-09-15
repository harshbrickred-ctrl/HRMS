# 25 — Sprint Plan (2-Week Cadence)

**Product:** PeopleOS  
**Cadence:** 2-week sprints (Weeks 11–12 modeled as Sprint 5 & 6 one-week release sprints)  
**Committed scope:** P0 MVP only  
**Capacity reference:** ~145–155 effective person-days; ~127 commit-able after 15% contingency — **Estimate** ([capacity-sheet](appendices/capacity-sheet.md))  
**Evidence labels:** **Fact** | **Assumption** | **Estimate** | **Metric-to-measure**

**Related:** [24-project-plan-12-weeks.md](24-project-plan-12-weeks.md) · [16-testing-strategy.md](16-testing-strategy.md) · [27-change-management.md](27-change-management.md)

---

## Cadence & ceremonies (**Assumption**)

| Ceremony | When | Duration | Owner |
|----------|------|----------|-------|
| Sprint planning | Day 1 AM | 2h | Lead |
| Daily standup | Daily | 15m | Rotating |
| Backlog refinement | Mid-sprint | 1h | Lead + HR as needed |
| Sprint review / demo | Last day | 1h | Lead |
| Retrospective | After review | 45m | FS/QA facilitates |
| Stakeholder HR sync | 2× / sprint | 45m | Lead |

---

## Story ID convention

`US-<domain>-<nnn>` e.g. `US-LEAVE-012`. Map to FR IDs when 06/07 exist. Priority tags: **P0** only in committed sprint goals; P1 may appear as stretch explicitly labeled **non-committed**.

---

# Sprint 0 — Discovery & Ready-for-Build (Weeks 1–2)

### Sprint goal

Freeze P0 MVP, produce build-ready PRD/UX/ADRs/schema, and complete greytHR export discovery sufficient to start foundation coding.

### Features / outcomes

- Written P0 / P1 / P2 lists
- UX wireframes for ESS, Manager approve, HR employee
- ADRs 001–010 drafted/approved
- Schema v1 reviewed
- greytHR Excel/CSV inventory + draft field map
- Sprint 1 backlog estimated

### Stories (representative)

| ID | Story | Owner | Est. days | Priority |
|----|-------|-------|-----------|----------|
| US-DISC-001 | As CEO/HR, I want a frozen P0 list so engineering does not thrash | Lead+HR | 3 | P0 |
| US-DISC-002 | As FE, I need approved wireframes for leave request & approve | FE | 4 | P0 |
| US-DISC-003 | As BE, I need schema v1 covering employee, leave, attendance, audit | BE+Lead | 5 | P0 |
| US-DISC-004 | As team, we approve ADRs for stack, auth, tenancy column, files, CI | Lead | 4 | P0 |
| US-MIG-001 | As FS/QA+HR, we inventory greytHR export formats and samples | FS/QA+HR | 4 | P0 |
| US-DEV-001 | As FS/QA, spike Docker Compose + empty CI workflow | FS/QA | 3 | P0 |

### Developer allocation (**Estimate**)

| Role | Focus | Days (effective) |
|------|-------|------------------|
| Lead | Scope, ADRs, stakeholder | ~8 |
| BE | Schema, domain boundaries | ~7 |
| FE | UX, design system baseline | ~7 |
| FS/QA | Compose/CI spike, migration discovery | ~7 |

### Testing this sprint

- Define UAT personas and top journeys
- Traceability template FR → story → test
- No production code coverage gate yet

### Demo

- Walkthrough of P0 scope board
- UX click-through (Figma/static)
- ERD + ADR summary
- greytHR sample file gallery

### Review / Retro focus

- Did we over-scope P0?
- Is payroll temptation documented as out-of-scope?

### Exit criteria

- [ ] P0 list signed by Lead + HR (**Assumption**: CEO endorsement via 01)
- [ ] ADRs blocking foundation approved
- [ ] Schema v1 review notes closed or ticketed
- [ ] Sprint 1 stories estimated and capacity-fit
- [ ] At least one real greytHR export sample in repo `fixtures/` (sanitized)

---

# Sprint 1 — Foundation (Weeks 3–4)

### Sprint goal

Ship a secure runnable foundation: Dockerized NestJS+React+PostgreSQL, authentication, RBAC, audit trail, and PR CI on free-tier GitHub Actions.

### Features

- Login / logout / session
- Role seeds + API authorization
- Audit on mutating APIs
- Health checks
- CI: build → lint → unit → (smoke) 

### Stories

| ID | Story | Owner | Est. | Priority |
|----|-------|-------|------|----------|
| US-AUTH-001 | Employee can log in with company credentials (MVP local IdP) | BE+FE | 5 | P0 |
| US-AUTH-002 | Session expires per policy; logout clears session | BE+FE | 2 | P0 |
| US-RBAC-001 | HR Admin can access admin APIs; Employee cannot | BE | 4 | P0 |
| US-RBAC-002 | FE route guards mirror server permissions | FE | 3 | P0 |
| US-AUD-001 | Mutating actions write audit rows (who/when/what) | BE | 3 | P0 |
| US-OPS-001 | `docker compose up` brings API, web, DB, (optional MinIO) | FS/QA | 4 | P0 |
| US-OPS-002 | PR pipeline runs on GitHub Actions free tier | FS/QA | 3 | P0 |
| US-SEC-001 | Secrets only via env; no secrets in git | Lead+FS/QA | 1 | P0 |

### Developer allocation (**Estimate**)

| Role | Focus |
|------|-------|
| Lead | Authz model, reviews, threat notes |
| BE | Auth, RBAC, audit APIs |
| FE | Login, shell, guards |
| FS/QA | Compose, CI, neg authz tests |

### Testing

- Unit: password hashing, permission checks
- API: authn/authz positive/negative
- CI must be green to merge

### Demo

- Live login as Employee vs HR Admin
- Show denied API (401/403)
- Show audit row
- Show Actions run (or local act fallback if minutes constrained)

### Exit criteria

- [ ] Compose onboarding doc works on clean machine
- [ ] Automated authz negatives pass
- [ ] Audit verified on create employee stub or equivalent
- [ ] Branch protection + required checks documented
- [ ] No P0 foundation defects Sev-1 open

---

# Sprint 2 — Core HR + Leave (Weeks 5–6)

### Sprint goal

HR can manage employees/org; employees can request leave against policies with correct balances.

### Features

- Employee CRUD / search
- Org units + manager link
- Leave types, policies, balances
- Leave request create/list/cancel-draft

### Stories

| ID | Story | Owner | Est. | Priority |
|----|-------|-------|------|----------|
| US-EMP-001 | HR creates/updates employee master fields | BE+FE | 6 | P0 |
| US-EMP-002 | HR assigns manager and org unit | BE+FE | 3 | P0 |
| US-EMP-003 | Search/filter employees | BE+FE | 3 | P0 |
| US-LEAVE-001 | HR configures leave types & policies | BE+FE | 5 | P0 |
| US-LEAVE-002 | System maintains leave balances | BE | 5 | P0 |
| US-LEAVE-003 | Employee submits leave request | BE+FE | 4 | P0 |
| US-LEAVE-004 | Employee views own requests & balances | FE | 2 | P0 |
| US-LEAVE-005 | Overlap / insufficient balance rejected | BE | 2 | P0 |

### Developer allocation

| Role | Focus |
|------|-------|
| Lead | Domain rules review, greytHR field alignment |
| BE | Employee + Leave domains |
| FE | HR admin + ESS leave UI |
| FS/QA | API suites, seed data, balance edge cases |

### Testing

- Uniqueness (employee code/email)
- Balance math property tests
- UI smoke HR + ESS

### Demo

- Create employee → set policy → request leave → balance updates
- Show rejection cases

### Exit criteria

- [ ] HR signs off field set vs greytHR map (gaps ticketed, not silent)
- [ ] Leave happy path + 3 negative rules automated
- [ ] No Sev-1 in Employee/Leave
- [ ] Sprint 3 workflow dependencies (manager link) verified in data

---

# Sprint 3 — Workflow + Attendance (Weeks 7–8)

### Sprint goal

Leave approvals work end-to-end; attendance can be recorded/imported for the pilot cohort.

### Features

- Approval state machine (submit → pending → approved/rejected)
- Manager inbox
- Attendance daily records + CSV import
- Basic attendance views

### Stories

| ID | Story | Owner | Est. | Priority |
|----|-------|-------|------|----------|
| US-WF-001 | Manager approves/rejects leave with comment | BE+FE | 5 | P0 |
| US-WF-002 | Unauthorized user cannot approve | BE | 2 | P0 |
| US-WF-003 | On approve, balance finalizes; on reject, restores | BE | 3 | P0 |
| US-WF-004 | Optional HR second step if policy requires | BE+FE | 3 | P0 |
| US-ATT-001 | HR/Manager views team attendance | BE+FE | 4 | P0 |
| US-ATT-002 | CSV import attendance with validation report | BE+FS/QA | 5 | P0 |
| US-ATT-003 | Duplicate date+employee rejected/idempotent | BE | 2 | P0 |
| US-E2E-001 | E2E leave request→approve | FS/QA | 3 | P0 |

### Developer allocation

| Role | Focus |
|------|-------|
| Lead | Workflow generality vs YAGNI |
| BE | Workflow + attendance |
| FE | Manager inbox + attendance UI |
| FS/QA | E2E, import fixtures, perf smoke on import |

### Testing

- E2E critical path
- Import reconciliation on fixture file
- Authz on approve

### Demo

- Full leave approval journey
- Import attendance CSV and show summary + error rows

### Exit criteria

- [ ] E2E leave path green in CI or nightly
- [ ] Import dry-run on sanitized real export sample
- [ ] P0 workflow scope frozen (no generic “all request types”)
- [ ] Attendance P1 corrections explicitly deferred if behind

---

# Sprint 4 — ESS / Manager Experience + Docs / Notifications / Reports (Weeks 9–10)

### Sprint goal

Pilot-ready employee and manager experience with documents, in-app notifications, and P0 reports.

### Features

- ESS home & profile
- Manager team + approvals dashboard
- Document upload/list/download with RBAC
- Notification center (in-app)
- Reports: headcount, leave balances, attendance summary

### Stories

| ID | Story | Owner | Est. | Priority |
|----|-------|-------|------|----------|
| US-ESS-001 | Employee lands on ESS with balances & pending items | FE | 4 | P0 |
| US-ESS-002 | Employee views profile; edits allowed fields only | BE+FE | 3 | P0 |
| US-MGR-001 | Manager sees team roster & pending approvals | FE+BE | 4 | P0 |
| US-DOC-001 | HR uploads employee document with metadata | BE+FE | 4 | P0 |
| US-DOC-002 | Wrong role cannot download document | BE+FS/QA | 2 | P0 |
| US-NOTIF-001 | User receives in-app notification on approval action | BE+FE | 3 | P0 |
| US-RPT-001 | Headcount report by org/status | BE+FE | 3 | P0 |
| US-RPT-002 | Leave balance report | BE+FE | 2 | P0 |
| US-RPT-003 | Attendance summary report | BE+FE | 2 | P0 |
| US-A11Y-001 | Critical screens keyboard + label pass | FE+FS/QA | 2 | P0 |

### Developer allocation

| Role | Focus |
|------|-------|
| Lead | Report definitions with HR; security on files |
| BE | Documents, notifications, report queries |
| FE | ESS/Manager polish, docs UI, report screens |
| FS/QA | E2E expansion, a11y, authz document tests |

### Testing

- Document authz matrix
- Notification creation hooks
- Report totals vs SQL fixture checks
- A11y on P0 screens

### Demo

- Day-in-the-life: Employee + Manager + HR
- Document deny demo
- Three P0 reports

### Exit criteria

- [ ] Top 5 pilot journeys documented and demoed
- [ ] Document authz automated
- [ ] HR accepts P0 report set (or cuts one with written note)
- [ ] Feature freeze for net-new entering Sprint 5

---

# Sprint 5 — Security, UAT, Migration Dry-Run (Week 11)

### Sprint goal

Prove the system is safe and usable for pilot: UAT pass, security checklist complete, migration dry-run reconciled.

### Features

- No net-new P0 features (bugfixes & must-fix gaps only)
- Hardening, rate limits basics, headers, backup drill
- Migration dry-run #1 and #2

### Stories

| ID | Story | Owner | Est. | Priority |
|----|-------|-------|------|----------|
| US-SEC-010 | Complete security checklist & remediate Sev-1/2 | Lead+FS/QA | 4 | P0 |
| US-UAT-001 | Execute UAT scripts with HR; log evidence | FS/QA+HR | 4 | P0 |
| US-MIG-010 | Dry-run import employees/leave/attendance; reconcile | FS/QA+HR | 5 | P0 |
| US-OPS-010 | Backup/restore drill on pilot host | FS/QA | 2 | P0 |
| US-REG-001 | Full regression suite green | FS/QA | 2 | P0 |
| US-GO-001 | Draft Go/No-Go pack | Lead | 1 | P0 |

### Developer allocation

All on defects + evidence; FE/BE pair on UAT bugs; FS/QA owns migration ops.

### Testing

- UAT + regression + security + restore drill
- Performance smoke on list endpoints (**Estimate**: smoke, not full load test)

### Demo

- UAT scoreboard
- Migration reconciliation sheet
- Known-issues list

### Exit criteria

- [ ] UAT exit criteria met or CEO/HR waiver signed
- [ ] Migration reconciliation within agreed thresholds ([21-data-migration.md](21-data-migration.md))
- [ ] Sev-1 = 0; Sev-2 plan exists
- [ ] Go/No-Go packet ready for Sprint 6 decision

---

# Sprint 6 — Pilot Go-Live & Training (Week 12)

### Sprint goal

Pilot cohort live on internal host; training done; hypercare operating; rollback package retained.

### Features

- Production-like config for pilot
- Monitoring/alerting MVP
- Training delivery
- Hypercare rota

### Stories

| ID | Story | Owner | Est. | Priority |
|----|-------|-------|------|----------|
| US-GO-010 | Execute go-live checklist & cutover | Lead+FS/QA | 3 | P0 |
| US-GO-011 | Post-cutover smoke & data spot checks | FS/QA+HR | 2 | P0 |
| US-TRN-001 | Deliver HR Admin training | HR+Lead | 1 | P0 |
| US-TRN-002 | Deliver Manager + Employee pilot training | HR+FE | 1 | P0 |
| US-SUP-001 | Hypercare rota & incident channel live | Lead | 1 | P0 |
| US-GO-012 | Rollback package verified offline | FS/QA | 1 | P0 |

### Developer allocation

Cutover war-room; minimal coding; documentation & support.

### Testing

- Production smoke
- Monitoring heartbeat
- First-day adoption checks (**Metric-to-measure**)

### Demo

- Live pilot environment walkthrough for leadership
- Training completion counts
- Support dashboard empty/known issues

### Exit criteria

- [ ] Explicit **Go** recorded (or No-Go with rollback)
- [ ] Pilot users can log in and complete leave request path
- [ ] Backups scheduled/verified
- [ ] 30/60/90 plan kicked off ([27-change-management.md](27-change-management.md))
- [ ] Retrospective on 12-week delivery captured

---

## Cross-sprint allocation summary (**Estimate** person-days commit-able ~127)

| Sprint | Lead | BE | FE | FS/QA | Notes |
|--------|------|----|----|-------|-------|
| 0 | 8 | 7 | 7 | 7 | Heavy discovery |
| 1 | 7 | 10 | 8 | 9 | Foundation |
| 2 | 6 | 12 | 10 | 8 | Core HR + Leave |
| 3 | 6 | 11 | 9 | 9 | Workflow + Attendance |
| 4 | 6 | 10 | 12 | 9 | UX-heavy |
| 5 | 5 | 6 | 5 | 8 | Harden / UAT |
| 6 | 4 | 3 | 3 | 5 | Go-live |
| **≈** | **42** | **59** | **54** | **55** | Totals exceed single-role commit band — **rebalance in planning**; use as directional load, not accounting |

*Interpretation:* Backend load is highest; Lead absorbs review/architecture rather than equal feature points. Re-fit each planning day to ~32 commit-able days/role.

---

## Stretch (explicitly non-committed)

| Item | Earliest | Condition |
|------|----------|-----------|
| Leave escalation SLA timers | Post-pilot | Contingency intact |
| Attendance self-regularization | Post-pilot | UAT demand |
| Email notifications | Post-pilot | SMTP available without new spend |
| Extra reports | Post-pilot | HR prioritization |

---

## Definition of Ready (story)

- P0 tagged; user & acceptance criteria written
- Design/API contract linked
- Dependencies known
- Test notes (happy + 1 negative)
- Fits sprint capacity

## Definition of Done (story)

- Code + tests merged
- Authz considered
- Audit if mutating
- Docs/ADR updated if needed
- Demoable

---

*No velocity invented pre-Sprint 1. Re-baseline points after Sprint 1 actuals — **Metric-to-measure**.*
