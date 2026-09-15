# 22 — Deployment Guide

**Product:** PeopleOS  
**Stage A:** Local Docker Compose + internal pilot host  
**Stage B:** Azure (notes only; not Week-12 default)  
**Evidence labels:** **Fact** | **Assumption** | **Estimate** | **Metric-to-measure**

**Related:** [17-devops-strategy.md](17-devops-strategy.md) · [21-data-migration.md](21-data-migration.md) · [27-change-management.md](27-change-management.md) · [18-zero-cost-architecture.md](18-zero-cost-architecture.md) · [19-azure-target-architecture.md](19-azure-target-architecture.md)

---

## 1. Purpose

Enable any engineer to run PeopleOS locally and enable FS/QA + Lead to deploy and operate the **internal pilot** without cloud spend. Azure steps are **preparatory**, not committed MVP cost.

---

## 2. Architecture deploy units (Stage A)

| Unit | Image/Process | State |
|------|---------------|-------|
| `api` | NestJS | Stateless |
| `web` | React build via nginx (or Vite preview only for local) | Stateless |
| `db` | PostgreSQL | Volume |
| `object` (optional) | MinIO or filesystem volume | Volume |
| `proxy` (optional) | Caddy/nginx TLS terminator | Stateless |

**Assumption:** Modular monolith — one API deployable.

---

## 3. Prerequisites

| Tool | Purpose | Cost note |
|------|---------|-----------|
| Docker Desktop or Docker Engine + Compose | Runtime | Docker Desktop licensing depends on org size — **verify**; Engine+Compose on Linux VM often safer for company host |
| Node.js LTS (local undockered dev) | Optional | OSS |
| Git | Source | OSS |
| Make/Taskfile or npm scripts | DX | Optional |

---

## 4. Local Docker Compose (developer)

### 4.1 Quick start (**Assumption** script names — align to repo when created)

```bash
git clone <repo-url>
cd HRMS
cp .env.example .env
# edit secrets: POSTGRES_PASSWORD, JWT_SECRET, etc.
docker compose up --build
```

| Service | Typical URL |
|---------|-------------|
| Web | http://localhost:3000 |
| API | http://localhost:4000 |
| API docs | http://localhost:4000/api/docs |
| MinIO console | http://localhost:9001 (if enabled) |

### 4.2 First-run

1. Migrations auto-run on API start **or** `docker compose run api npm run migration:run`  
2. Seed: `docker compose run api npm run seed:mini`  
3. Login with seeded HR Admin / Employee (credentials in `.env.example` comments — change for shared hosts)  

### 4.3 Useful commands

| Action | Command (illustrative) |
|--------|------------------------|
| Logs | `docker compose logs -f api` |
| Reset DB volume | `docker compose down -v` (destroys data) |
| Rebuild API | `docker compose up --build api` |

### 4.4 Local undockered (optional)

- Run PostgreSQL in Compose only; API/Web via `npm run start:dev`  
- Keeps DX fast; still test Compose before PR  

---

## 5. Configuration reference

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | Postgres connection |
| `JWT_SECRET` / session secret | Yes | Pilot: long random |
| `APP_BASE_URL` | Yes | CSRF/CORS origins |
| `FILE_STORAGE_MODE` | Yes | `local` \| `s3compatible` |
| `S3_ENDPOINT` | If MinIO | |
| `FEATURE_*` | Optional | Feature flags |
| `LOG_LEVEL` | Optional | `info` default |

**Never** commit real `.env`. Provide `.env.example` only.

---

## 6. Internal pilot host guidance (Stage A “production”)

### 6.1 Host sizing (**Estimate**)

| Resource | Pilot aspiration (~50–100 users) |
|----------|----------------------------------|
| CPU | 4 vCPU |
| RAM | 8 GB |
| Disk | 100 GB+ SSD (DB + backups + files) |
| OS | Linux preferred; Windows Server with Docker possible |

These are **estimates**, not benchmarks. Measure CPU/RAM after go-live (**Metric-to-measure**).

### 6.2 Network

| Item | Guidance |
|------|----------|
| Exposure | Prefer **internal VPN / private network only** — not public internet |
| TLS | Terminate TLS on reverse proxy with internal cert or org PKI |
| Firewall | Allow 443 from corp network only; DB port **not** exposed beyond localhost/docker net |
| DNS | `peopleos.internal.example` — **Assumption** naming |

### 6.3 Deploy steps (pilot)

1. Lead + FS/QA confirm Go  
2. Maintenance window announced  
3. Backup existing volumes/DB (if re-deploy)  
4. Pull immutable images `@sha256:…` or load tar  
5. Apply `compose.pilot.yaml` with pilot `.env`  
6. Run migrations  
7. Run cutover import if scheduled ([21-data-migration.md](21-data-migration.md))  
8. Smoke tests (login, leave, report)  
9. Enable user access / remove maintenance page  
10. Monitor logs 2 hours  

### 6.4 Backup

| What | Frequency (**Assumption**) | Retention |
|------|----------------------------|-----------|
| PostgreSQL dump | Daily + pre-migrate | 14–30 days |
| File volume | Daily | 14–30 days |
| Compose + env (secrets store) | On change | Secure store |

Test restore Week 11.

### 6.5 Monitoring (MVP)

- Healthcheck cron every 1–5 minutes  
- Disk space alert  
- Docker restart policy `unless-stopped`  
- Central chat alert webhook if available without new spend  

---

## 7. Environment overlays

| File | Use |
|------|-----|
| `compose.yaml` | Base local |
| `compose.ci.yaml` | CI ephemeral |
| `compose.qa.yaml` | Shared QA |
| `compose.pilot.yaml` | Pilot resource limits, restart, logging |

Keep differences minimal; prefer env vars over forked Dockerfiles.

---

## 8. Migration during deploy

1. Always backup first  
2. Run migrations before switching traffic to new API  
3. If migration fails → stop → restore → incident  
4. Record migration version in run log  

---

## 9. Rollback procedure (pilot)

| Step | Action |
|------|--------|
| 1 | Enable maintenance page |
| 2 | `docker compose` pin previous image digests |
| 3 | If schema incompatible and no expand/contract path → restore DB snapshot |
| 4 | Smoke previous version |
| 5 | Comms: users revert to greytHR for affected processes |
| 6 | Postmortem within 2 business days |

---

## 10. Security hardening checklist (host)

- [ ] Host OS patched  
- [ ] SSH keys only; no password SSH on Linux  
- [ ] Non-root containers where practical  
- [ ] Secrets file permissions `600`  
- [ ] DB not published to 0.0.0.0  
- [ ] TLS on user-facing endpoint  
- [ ] Admin UI limited by RBAC + network  
- [ ] Audit log volume included in backup  

---

## 11. Stage B — Azure notes (post-validation)

**Trigger:** Internal pilot accepted + leadership approves spend (see cost/KPI docs).  
**Do not** deploy paid Azure by default in Week 12.

### 11.1 Likely service mapping (**Assumption** — finalize in ADRs)

| Concern | Azure target |
|---------|--------------|
| API + Web | Azure Container Apps or App Service |
| PostgreSQL | Azure Database for PostgreSQL Flexible Server |
| Files | Blob Storage (private) |
| Secrets | Key Vault |
| CI/CD | GitHub Actions / Azure DevOps |
| DNS/TLS | Front Door / App Gateway / native TLS |
| Monitoring | Azure Monitor + App Insights |
| Network | VNet, private endpoints |

### 11.2 Migration from Stage A

1. Export pilot DB → import to Azure PG  
2. Copy file blobs  
3. Point DNS  
4. Dual-run optional briefly  
5. Decommission host when stable  

### 11.3 Cost honesty

Azure is **paid**. Use formal estimates in cost strategy docs; this guide only lists building blocks. No ROI claims.

---

## 12. Roles

| Action | Local | Pilot deploy |
|--------|-------|--------------|
| Day-to-day | Each engineer | — |
| Pipeline changes | FS/QA + Lead | — |
| Pilot cutover | — | Lead + FS/QA |
| Emergency rollback | — | Lead or FS/QA with Lead notify |

---

## 13. Troubleshooting

| Symptom | Checks |
|---------|--------|
| API unhealthy | `docker compose ps`, DB logs, `DATABASE_URL` |
| Login fails after migrate | Seed users; IdP config; clock skew |
| Upload fails | Volume mount; disk full; MinIO creds |
| Slow lists | DB indexes; explain analyze; host saturation |

---

## 14. Runbook artifacts to maintain

| Artifact | Owner |
|----------|-------|
| `.env.example` | FS/QA |
| Pilot deploy checklist (printed Week 12) | Lead |
| Backup/restore evidence | FS/QA |
| Image digest log | FS/QA |

---

*Stage A success = boring, repeatable Compose deploys. Stage B is optional evolution, not a Week-12 dependency.*
