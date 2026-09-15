# 16 — Testing Strategy

**Product:** PeopleOS (NestJS + React + PostgreSQL)  
**Audience:** FS/QA (owner), all engineers, HR (UAT)  
**Committed scope:** P0 MVP · 12-week internal pilot  
**Evidence labels:** **Fact** | **Assumption** | **Estimate** | **Metric-to-measure**

**Related:** [17-devops-strategy.md](17-devops-strategy.md) · [25-sprint-plan.md](25-sprint-plan.md) · [21-data-migration.md](21-data-migration.md) · [23-risk-register.md](23-risk-register.md)

---

## 1. Goals & non-goals

### Goals

- Prevent Sev-1 defects reaching pilot users
- Enforce authn/authz continuously
- Make leave/attendance/migration calculations trustworthy
- Create evidence for Go/No-Go

### Non-goals (12-week window)

- Full formal ISTQB program office
- Paid device labs / large commercial load platforms (**Assumption**: use OSS + local)
- Guaranteeing zero defects
- Invented quality ROI

---

## 2. Test pyramid

```text
                 /\
                /E2E\          few, critical journeys
               /------\
              / UI / a11y \    targeted
             /------------\
            /  API / integ  \  substantial
           /----------------\
          /   Unit (domain)   \  majority
         /--------------------\
```

| Layer | Share of automated effort (**Estimate**) | Owner |
|-------|------------------------------------------|-------|
| Unit | 50–60% | Code author |
| Integration / API | 25–30% | BE + FS/QA |
| UI component | 5–10% | FE |
| E2E | 10–15% | FS/QA |
| Manual UAT / exploratory | Parallel, time-boxed | HR + FS/QA |

Prefer many fast unit/domain tests over brittle UI E2E.

---

## 3. Unit tests

### Backend (NestJS)

| Focus | Examples |
|-------|----------|
| Domain pure logic | Leave balance ledger, overlap rules, attendance idempotency keys |
| Guards / policies | Permission evaluation matrix samples |
| Mappers / validators | DTO validation, CSV row parse |

**Tools (**Assumption**):** Jest (or Vitest if chosen in ADR) + Nest testing utilities.

### Frontend (React)

| Focus | Examples |
|-------|----------|
| Pure helpers | Date formatting IST, form validators |
| Hooks with mocked API | Leave form state transitions |

Avoid screenshot-only unit tests.

### Expectations

| Area | Expectation | Label |
|------|-------------|-------|
| New domain modules | Meaningful unit tests for rules | **Assumption** (team standard) |
| Coverage tool | Collected in CI as signal, not vanity | **Fact** of intent |
| Critical domains (leave, RBAC, migration transforms) | Higher scrutiny in review | **Assumption** |

---

## 4. Integration tests

| Type | What | Environment |
|------|------|-------------|
| Repository / DB | Migrations apply; constraints enforce | PostgreSQL in Compose / CI service |
| Module integration | API + DB + auth guard | Testcontainers or Compose network (**Assumption**) |
| File storage | Upload metadata + ACL | Local/MinIO in Compose |

**Rules:** No shared mutable “dev laptop DB” as source of truth for CI; migrations must run from empty.

---

## 5. API tests

| Suite | Covers |
|-------|--------|
| Contract | Status codes, schema shapes (OpenAPI-aligned) |
| Authn | Missing/invalid token → 401 |
| Authz | Wrong role → 403 on each privileged route |
| Validation | 400 on bad payloads |
| Idempotency | Re-POST import / duplicate leave where specified |

**Owner:** BE writes with feature; FS/QA maintains regression pack `tests/api`.

**Release gate:** Authz negative pack green on every PR touching API or guards.

---

## 6. UI tests

| Level | Tooling (**Assumption**) | Scope |
|-------|--------------------------|-------|
| Component | React Testing Library | Forms, permission-conditional render |
| Visual | Optional manual only in MVP | No paid Percy unless already licensed |

UI tests assert behavior and accessibility roles, not pixel perfection.

---

## 7. E2E tests

### Critical journeys (P0)

1. Login as Employee → request leave → logout  
2. Login as Manager → approve leave → employee balance updated  
3. Login as HR → create employee → assign manager  
4. HR → upload document → Employee can/can’t download per ACL  
5. HR → run headcount report (smoke)  
6. Attendance CSV import → row counts match control totals  

### Practice

| Practice | Detail |
|----------|--------|
| Stability | Test IDs on critical controls; no CSS-selector soup |
| Data | Dedicated seed; reset between specs |
| Where run | Nightly + pre-release; subset on PR if minutes allow |
| Free-tier | Prefer nightly full E2E if Actions minutes scarce — **Fact**: GitHub Free minutes are finite (see DevOps doc) |

---

## 8. Regression

| Trigger | Suite |
|---------|-------|
| Every PR | Unit + lint + affected API tests |
| Nightly | Full API + E2E critical |
| Sprint 5 / pre-pilot | Full regression + migration dry-run checks |
| Hotfix | Smoke + failed-area deep tests |

Maintain a living “regression charter” checklist in repo `docs/qa/` or test README (**Assumption** location).

---

## 9. Security testing

| Activity | Cadence | Owner |
|----------|---------|-------|
| Dependency vulnerability scan (npm audit / OSV) | PR or nightly | FS/QA |
| SAST (ESLint security plugins / Semgrep OSS if adopted) | PR | FS/QA |
| Secret scan | PR | FS/QA |
| Authz matrix automation | PR on touched routes | BE+FS/QA |
| Security checklist (OWASP-inspired) | Sprint 5 | Lead |
| Lightweight abuse cases | Sprint 5 | Lead+FS/QA |

**Non-claim:** This is not a substitute for a full external penetration test. Label any checklist completion as **internal hygiene**, not certification.

### Abuse cases (minimum)

- Horizontal privilege: Employee A reads Employee B documents/leave
- Vertical privilege: Employee calls HR-only APIs
- IDOR on `/employees/:id`, `/documents/:id`
- Migration upload of malformed/oversized files

---

## 10. Performance testing

| Scope MVP | Approach | Label |
|-----------|----------|-------|
| List endpoints (employees, leave) | k6 or Artillery smoke against QA | **Estimate** tool choice |
| CSV import 500–2000 rows | Time budget agreed with HR | **Assumption** |
| Full scalability study | Deferred Stage B | **Fact** of plan |

**Targets (initial, to be measured — not SLAs sold to CEO):**

| Metric | Pilot aspiration | Label |
|--------|------------------|-------|
| p95 leave list for one user | < 1s on pilot host | **Estimate** / **Metric-to-measure** |
| Import 1k attendance rows | < 5 min wall clock | **Estimate** / **Metric-to-measure** |

Do not publish as contractual performance guarantees.

---

## 11. Accessibility (a11y)

| Level | Requirement |
|-------|-------------|
| P0 screens | Keyboard operable; labels on inputs; visible focus |
| Automated | axe-core (or eslint-plugin-jsx-a11y) on critical pages in CI when feasible |
| Manual | Screen reader spot-check optional if expertise available |

**Standard aspiration:** WCAG 2.2 AA for P0 flows — **Assumption** target; track gaps as debt, not silent fail.

---

## 12. UAT

### Participants

| Persona | Who | Journeys |
|---------|-----|----------|
| HR Admin | HR ops | Employee, policy, reports, documents |
| Manager | 2–3 pilot managers | Approvals, team attendance |
| Employee | 5–10 pilot employees | ESS leave, profile, notifications |

### UAT process

1. FS/QA prepares scripts with expected results  
2. HR executes on QA/UAT environment  
3. Defects logged with severity  
4. Exit review with Lead  

### UAT exit criteria (Sprint 5)

- [ ] All P0 scripts executed
- [ ] Sev-1 = 0
- [ ] Sev-2 either fixed or waived in writing by HR+Lead
- [ ] Migration dry-run reconciliation accepted
- [ ] Training draft reviewed by HR

---

## 13. Coverage expectations

| Layer | Expectation | Label |
|-------|-------------|-------|
| Overall line % | Useful signal; **no** vanity 90% mandate | **Assumption** |
| Leave balance + RBAC + transform code | Reviewer rejects PR without tests | **Assumption** (policy) |
| E2E | 6 critical journeys automated before pilot | **Estimate** |
| Authz negatives | 100% of privileged routes have at least one deny test before pilot | **Assumption** target |

**Metric-to-measure post-Sprint 2:** flaky test rate; aim <5% flaky on nightly.

---

## 14. Release gates

### Pull request

| Gate | Blocking? |
|------|-----------|
| Build + lint | Yes |
| Unit tests | Yes |
| API authz tests (if API/guard changed) | Yes |
| SAST/secret scan high findings | Yes |
| Full E2E | No (unless minutes allow / path critical) |

### Promote Dev → QA

| Gate | Blocking? |
|------|-----------|
| PR gates + migrations apply clean | Yes |
| Smoke E2E subset | Yes |

### Promote QA → UAT

| Gate | Blocking? |
|------|-----------|
| Sprint regression green | Yes |
| Known Sev-1 = 0 | Yes |

### Promote UAT → Pilot (Prod-like)

| Gate | Blocking? |
|------|-----------|
| UAT exit criteria | Yes |
| Security checklist Sev-1/2 remediations | Yes |
| Backup/restore drill | Yes |
| Go/No-Go formal | Yes |
| Migration reconciliation | Yes |

---

## 15. Environments & test data

| Env | Purpose | Data |
|-----|---------|------|
| Local | Dev | Synthetic seeds |
| CI | PR verification | Ephemeral DB + fixtures |
| Dev | Integrated shared | Synthetic + sanitized subsets |
| QA | QA/regression | Stable seed + import fixtures |
| UAT | Business acceptance | Near-prod sanitized extract |
| Pilot | Limited real users | Migrated pilot cohort |

### Test data rules

- **No** production PII in laptops or public CI logs — **Fact** of policy intent
- Sanitize greytHR extracts (mask PAN/Aadhaar if present; prefer employee codes)
- Version fixture CSVs in repo under `fixtures/` with README of provenance
- Golden files for reconciliation totals

### Seed profiles

| Profile | Contents |
|---------|----------|
| `seed-mini` | 10 employees, 2 managers, leave policies |
| `seed-pilot` | ~50–100 employees matching pilot org slice — **Assumption** size |
| `seed-perf` | Optional larger synthetic for smoke |

---

## 16. Defect severity

| Sev | Definition | Pilot rule |
|-----|------------|------------|
| 1 | Data loss, security breach, leave balance corruption, login down | Must fix before Go |
| 2 | Major journey blocked with workaround absent | Fix or written waiver |
| 3 | Minor wrong UI / non-critical report | Backlog |
| 4 | Cosmetic | Backlog |

---

## 17. Roles & RACI (testing)

| Activity | Lead | BE | FE | FS/QA | HR |
|----------|------|----|----|-------|-----|
| Strategy | A | C | C | R | I |
| Unit/API automation | C | R | C | A | I |
| E2E | C | C | C | R | I |
| UAT scripts | C | C | C | R | C |
| UAT execution | I | I | I | C | R |
| Security tests | A | C | C | R | I |
| Sign Go quality | R | C | C | C | C |

---

## 18. Tooling summary (Stage A)

| Need | Stage A (OSS / free tier) | Stage B note |
|------|---------------------------|--------------|
| Unit/API | Jest/Vitest, Supertest | Same |
| E2E | Playwright or Cypress | Same |
| Perf smoke | k6 / Artillery | Azure load tools optional |
| A11y | axe-core | Same |
| Security | npm audit, secret scan, Semgrep OSS optional | Defender / DevOps advanced scans |
| CI host | GitHub Actions **free tier (limited minutes)** | Azure DevOps / GitHub on Azure |

Never describe free tier as unlimited — see [17-devops-strategy.md](17-devops-strategy.md).

---

## 19. Evidence for Go/No-Go

Package must include:

- Latest regression report
- UAT sign-off sheet
- Security checklist
- Migration reconciliation
- Open defect list with severities
- Performance smoke notes (**Metric-to-measure** actuals)

---

*Quality is a gate, not a slogan. No invented ROI from “fewer bugs.”*
