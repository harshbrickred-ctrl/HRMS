# 17 — DevOps & CI/CD Strategy

**Product:** PeopleOS  
**Stage A:** Local Docker Compose + OSS + **GitHub Actions free tier**  
**Stage B:** Azure (App hosting, DB, storage, monitoring) + Azure DevOps and/or GitHub on Azure  
**Evidence labels:** **Fact** | **Assumption** | **Estimate** | **Metric-to-measure**

**Related:** [16-testing-strategy.md](16-testing-strategy.md) · [22-deployment-guide.md](22-deployment-guide.md) · [18-zero-cost-architecture.md](18-zero-cost-architecture.md) · [19-azure-target-architecture.md](19-azure-target-architecture.md)

---

## 1. Principles

1. **Pipeline before features mature** — CI from Sprint 1  
2. **Same artifacts promote** Dev → QA → UAT → Pilot  
3. **Migrations are versioned and reversible where practical**  
4. **Secrets never in git**  
5. **Free tier ≠ unlimited** — plan for minute exhaustion  
6. **No invented cost savings ROI** — track actual minutes and outages as **Metric-to-measure**

---

## 2. Target pipeline (conceptual)

```text
Developer
  → feature branch
  → Pull Request
  → Build (NestJS + React)
  → Static analysis (lint / SAST)
  → Unit tests
  → Integration / API tests
  → Security scan (deps + secrets)
  → Artifact (container images or build tarball)
  → Deploy Development
  → Deploy QA
  → Deploy UAT
  → Deploy Production (Pilot)
```

| Stage | Stage A reality | Label |
|-------|-----------------|-------|
| Build→tests on PR | GitHub Actions | **Assumption** (tool choice locked in ADR) |
| Artifact | GHCR free tier or local registry / tar | **Assumption** |
| Dev/QA/UAT/Pilot hosts | Compose on shared internal VMs/PCs | **Assumption** |
| Azure deploy | Deferred until investment gate | **Fact** of plan |

---

## 3. Branching model

**Recommendation:** Trunk-based with short-lived feature branches (**Assumption**).

| Branch | Purpose | Protect? |
|--------|---------|----------|
| `main` | Always deployable; release source | Yes |
| `feature/*` | Work items | No |
| `hotfix/*` | Pilot Sev-1 | Fast-follow review |
| `release/*` | Optional if parallel hardening needed | Yes if used |

### PR rules

| Rule | Detail |
|------|--------|
| Reviews | ≥1 approval; Lead required for auth, RBAC, migrations, CI |
| Required checks | build, lint, unit, secret scan; API tests when applicable |
| Direct commit to `main` | Denied |
| Stale branches | Delete after merge |

### Commit hygiene

- Conventional messages optional but encouraged  
- No `--no-verify` in normal flow  
- Migration files in same PR as model changes when possible  

---

## 4. Environments

| Env | Who uses | Deploy trigger | Data |
|-----|----------|----------------|------|
| Local | Engineer | Manual Compose | Synthetic |
| CI | Automation | PR / schedule | Ephemeral |
| Dev | Team | Merge to `main` or manual | Synthetic |
| QA | FS/QA | Manual promote / tag | Stable fixtures |
| UAT | HR + business | Manual promote | Sanitized near-prod |
| Pilot (Prod) | Pilot users | Manual Go with checklist | Migrated cohort |

**Assumption:** Single-tenant runtime; env parity via Compose files overlays (`compose.yaml` + `compose.pilot.yaml`).

### Configuration

| Concern | Approach |
|---------|----------|
| Config | Env vars + `.env.example` committed |
| Secrets | `.env` local / OS secret store on host; never commit |
| Feature flags | DB or env flags for risky features |
| 12-factor | Stateless app containers; stateful only DB/volumes |

---

## 5. GitHub Actions free tier (Stage A) — limits honesty

| Topic | Guidance | Label |
|-------|----------|-------|
| GitHub Free for private repos includes **limited** Actions minutes/storage per month | Plan as **finite budget**, not infinite CI | **Fact** (GitHub publishes free-tier quotas; exact numbers change — **verify current docs** before CEO cost claims) |
| Concurrent jobs / minute multipliers (e.g., non-Linux) | Prefer **Linux** runners to stretch minutes | **Fact** of general free-tier design |
| When minutes exhausted | CI queues/fails until reset or paid | **Fact** of how free tiers behave |
| Mitigation | PR: unit+lint only; nightly: full E2E; local `act` or Compose test script fallback | **Estimate** operating model |

**Do not write in proposals:** “unlimited free CI.”  
**Do write:** “GitHub Actions free tier (limited monthly minutes; monitor usage).”

### Minute conservation tactics (**Estimate**)

1. Path filters (FE-only PR skips BE heavy jobs when safe)  
2. Cache `node_modules` / Nest build  
3. E2E nightly + on `release` tags, not every PR  
4. Matrix explosion forbidden in MVP  
5. Fail fast on lint  

**Metric-to-measure:** Actions minutes used per week; alert at 70% of monthly free allowance.

---

## 6. Static analysis & security in CI

| Check | Blocking on PR? | Notes |
|-------|-----------------|-------|
| ESLint / TypeScript | Yes | |
| Unit tests | Yes | |
| `npm audit` high/critical (policy) | Warn→Yes by Sprint 5 | May allow documented exceptions |
| Secret scanning | Yes | |
| SAST (Semgrep OSS optional) | Warn early; Yes for high by Sprint 5 | |
| License scan | Optional | |

---

## 7. Artifacts

| Artifact | Contents | Retention (**Assumption**) |
|----------|----------|----------------------------|
| API image | NestJS app | Last 10 tags |
| Web image | React static + nginx | Last 10 tags |
| Migration bundle | SQL/ORM migrations | With git |
| SBOM optional | Deferred | Stage B |

Promote by **digest/tag immutability**: QA tests image `:sha-abc`; Pilot deploys same digest.

---

## 8. Database migrations

| Rule | Detail |
|------|--------|
| Tool | Prisma / TypeORM / Knex / Flyway-style — pick in ADR; one only |
| Expand/contract | Prefer backward-compatible expands during pilot weeks |
| Order | Migrate before app rolling start |
| Review | Lead reviews destructive migrations |
| Backup | Snapshot before Pilot migrate |
| Rollback | Prefer forward fix; keep previous image + DB snapshot for true rollback |

### Rollback ladder

1. Feature flag off  
2. Redeploy previous app image (compatible schema)  
3. Restore DB snapshot (data loss window acknowledged)  
4. Maintenance page + incident comms  

---

## 9. Feature flags

| Flag examples | Default pilot |
|---------------|---------------|
| `attendance_csv_import` | On for HR |
| `documents_module` | On |
| `experimental_report_x` | Off |
| `notifications_email` | Off until SMTP approved |

Flags owned by Lead; documented in runbook. Flags are **not** a substitute for tests.

---

## 10. Secrets management

| Stage A | Stage B |
|---------|---------|
| Host env files with restricted NTFS/Unix perms | Azure Key Vault |
| CI secrets in GitHub Actions encrypted secrets | Same / Azure |
| Rotate pilot DB password at cutover | Managed identities where practical |

---

## 11. Observability (MVP)

| Signal | Stage A |
|--------|---------|
| Logs | Structured JSON to file/stdout; retain on host |
| Health | `/health` liveness; `/ready` DB check |
| Uptime | Simple cron curl + alert to team chat |
| APM | Deferred Stage B (App Insights etc.) |

**Metric-to-measure:** time-to-detect pilot outage; time-to-restore.

---

## 12. Stage B — Azure DevOps / GitHub on Azure (later)

When leadership funds Azure after validation gates:

| Area | Evolution |
|------|-----------|
| CI | GitHub Actions hosted on larger quotas **or** Azure Pipelines |
| CD | Azure Container Apps / App Service / AKS (per ADR) |
| Registry | ACR |
| DB | Azure Database for PostgreSQL |
| Secrets | Key Vault |
| Monitoring | Azure Monitor + App Insights |
| Networks | Private endpoints as required |
| Approvals | Environment approval gates in Azure DevOps / GitHub Environments |

**Migration of pipelines:** Keep YAML portable; avoid proprietary tasks where possible so GitHub↔Azure DevOps move is mechanical.

**Cost:** Stage B is **paid** — never label as free. Estimate separately in cost docs; this file only states capability direction.

---

## 13. Access control (DevOps)

| Role | CI change | Prod deploy | Secrets |
|------|-----------|-------------|---------|
| Lead | Approve | Approve | Manage |
| FS/QA | Edit pipelines | Execute with Lead | Limited |
| BE/FE | Feature PRs | No direct pilot deploy | No |
| HR | None | None | None |

---

## 14. Incident & rollback runbook hooks

Document in [22-deployment-guide.md](22-deployment-guide.md):

- Who can deploy Pilot  
- How to freeze deploys  
- How to roll back image  
- How to restore DB  
- Comms template  

---

## 15. Definition of Done — DevOps

Sprint 1 DoD includes:

- [ ] PR pipeline green on sample PR  
- [ ] Branch protection documented  
- [ ] Minute budget dashboard owner assigned (FS/QA)  
- [ ] `.env.example` complete  
- [ ] Rollback of app image rehearsed once on Dev  

---

## 16. Risks specific to DevOps

| Risk | Mitigation |
|------|------------|
| Free-tier minute exhaustion | Conserve; local fallback; ask for paid only with usage evidence |
| “Works on my machine” | Compose + CI parity |
| Migration breakage | Backup + expand/contract + dry-run |
| Secret leak in Actions logs | Masking; secret scan; log redaction |

See [23-risk-register.md](23-risk-register.md).

---

*DevOps exists to make the 12-week delivery *repeatable*. Free tier is a budget, not a blank check.*
