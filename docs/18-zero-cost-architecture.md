# 18 — Zero / Minimal-Cost Development Architecture (Stage A)

**Objective:** Develop and validate PeopleOS with **₹0 paid cloud** wherever reasonably achievable.  
Distinguish: **OSS (free)** · **Free tier (quota)** · **Trial** · **Existing license** · **Paid**.

---

## 1. Reference stack

| Layer | Choice | Cost class | Limitations | Prod suitability | Azure equivalent | Migration complexity |
|-------|--------|------------|-------------|------------------|------------------|----------------------|
| Frontend | React + Vite + TypeScript | OSS | None material | High | Static Web Apps / Blob+CDN / Container | Low |
| UI kit | Prefer lightweight (e.g. MUI or shadcn) | OSS | Design system effort | High | Same | Low |
| Backend | NestJS + TypeScript | OSS | Monolith discipline required | High | Container Apps | Low |
| ORM | Prisma | OSS | Some complex SQL harder | High | Same | Low |
| DB | PostgreSQL 16 in Docker | OSS | Ops on engineers | High with managed service | Azure Database for PostgreSQL | Low–Mid |
| Auth | Local argon2 passwords + JWT | OSS | No org SSO yet | Mid until Entra | Entra ID OIDC | Mid |
| Files | Local disk **or** MinIO | OSS | Backup discipline | Mid | Blob Storage | Mid |
| Email | Mailpit (dev) / company SMTP | OSS / Existing | Mailpit not prod | Low/High | ACS / SMTP relay | Low |
| Cache | Redis Docker (optional) | OSS | Extra moving part | High | Azure Cache for Redis | Low |
| API docs | Swagger/OpenAPI | OSS | Keep in sync | High | Same + APIM later | Low |
| Containers | Docker + Compose | OSS / Docker Desktop licensing note* | Desktop license may apply to large orgs | Dev | ACR + ACA | Low |
| CI | GitHub Actions | **Free tier** | Included minutes (e.g. ~2,000/mo private on Free plans — verify current) | Mid | GitHub/Azure DevOps on Azure | Low |
| Logs | pino JSON logs | OSS | No long retention | Mid | App Insights | Low |
| Metrics | Optional Prometheus+Grafana local | OSS | Ops overhead | Mid | Azure Monitor | Mid |
| E2E | Playwright | OSS | Flaky if unmaintained | High | Same | Low |
| Secrets | `.env` local + git-ignored | Process | Easy to leak | Low | Key Vault | Mid |

\* **Fact to verify with IT:** Docker Desktop may require paid license for larger commercial use; alternative: Rancher Desktop / Podman (**OSS**).

---

## 2. Docker Compose services (canonical)

```yaml
# illustrative — implement in repo later
services:
  api:
  web:
  db: # postgres:16
  minio:
  mailpit:
  redis: # optional
```

---

## 3. Free-tier risks (do not call “free forever”)

| Service | Risk | Mitigation |
|---------|------|------------|
| GitHub Actions minutes | Exhaustion blocks CI | Self-hosted runner on existing VM; fewer jobs; cache |
| GitHub storage artifacts | Cap | Retain fewer artifacts |
| Any cloud trial | Expiry | **Do not** depend on trials for MVP architecture |

---

## 4. What we will not buy in Stage A

- Azure subscription (unless company already has unused credits — **Existing**, still document)  
- Managed Kafka, AKS, APIM  
- Commercial APM SaaS  
- Native mobile build pipelines  

---

## 5. Internal pilot hosting (still minimal cost)

**Preferred:** Existing company Windows/Linux VM or spare hardware + Docker.  
**Cost class:** Existing organizational resource.  
**Backup:** Nightly `pg_dump` to encrypted disk / existing file share.

---

## 6. Exit criteria to leave Stage A

1. UAT passed for P0.  
2. Pilot adoption metrics trending to thresholds.  
3. Security checklist signed.  
4. Leadership approves Azure Phase 2 budget categories (not necessarily line-item rupees yet).
