# 20 — Migration Strategy (Stage A → Azure Stage B)

**Status:** Component-level migration playbook  
**Related:** [18-zero-cost-architecture](18-zero-cost-architecture.md), [19-azure-target-architecture](19-azure-target-architecture.md), ADR-009, ADR-010, ADR-012  
**Discipline:** No invented prices; label Fact / Assumption / Estimate.

---

## 1. Migration principles

1. **Abstractions adapters first** — storage, email, secrets, clock, queue.  
2. **Move data plane carefully** — PostgreSQL and documents are the critical path.  
3. **Rehearse on non-prod Azure** before production cutover.  
4. **Keep Stage A runnable** until Stage B is proven (rollback story).  
5. **Do not migrate to AKS** as a “side quest.”

| Statement | Label |
|-----------|-------|
| Preferred compute target: Container Apps | **Fact** |
| Dual-run period may be days–weeks | **Estimate** |
| Payroll remains external during migration | **Fact** |

---

## 2. Readiness checklist

- [ ] `IObjectStorage`, `IEmailSender`, `ISecretProvider` interfaces in code  
- [ ] Config via env only (no host path assumptions in domain)  
- [ ] Migrations idempotent and versioned  
- [ ] Seed/scrub scripts for non-prod  
- [ ] Observability fields (`correlation_id`, `tenant_id`) stable  
- [ ] Document inventory of secrets  

---

## 3. Component-by-component plan

Each row: **Current → Azure → Process → Data concerns → Config → Complexity → Risks**

Complexity: **L** / **M** / **H**

---

### 3.1 NestJS API compute

| Field | Content |
|-------|---------|
| **Current** | Docker Compose `api` service |
| **Azure** | Azure Container Apps revision(s) |
| **Process** | Build image in GHA → push ACR → deploy ACA YAML/Bicep; smoke `/health`; run migrations job |
| **Data concerns** | Stateless; sticky sessions not required if JWT |
| **Config** | `DATABASE_URL`, storage, JWT keys, `DEFAULT_TENANT_ID`, App Insights connection |
| **Complexity** | **M** |
| **Risks** | Cold start if min replicas = 0; wrong ingress CORS; missing MI permissions |

---

### 3.2 Worker / background jobs

| Field | Content |
|-------|---------|
| **Current** | In-process or Compose worker profile |
| **Azure** | Second Container App with worker command **or** same app initially |
| **Process** | Deploy sibling app sharing image; ensure only one leader if using PG locks |
| **Data concerns** | Exactly-once not guaranteed — use idempotent handlers + outbox |
| **Config** | Same as API minus public ingress |
| **Complexity** | **M** |
| **Risks** | Double-processing emails; missed scale rules |

---

### 3.3 React SPA

| Field | Content |
|-------|---------|
| **Current** | Compose `web` / Vite dev server |
| **Azure** | Static Web Apps **or** Blob static + CDN **or** nginx sidecar pattern on ACA |
| **Process** | Build static assets; deploy; update API base URL; update redirect URIs |
| **Data concerns** | None (static) |
| **Config** | `VITE_API_URL`, auth redirect, feature flags bootstrap |
| **Complexity** | **L**–**M** |
| **Risks** | Mixed content; SPA routing 404 on refresh; CORS |

---

### 3.4 PostgreSQL

| Field | Content |
|-------|---------|
| **Current** | Compose Postgres volume |
| **Azure** | Azure Database for PostgreSQL Flexible Server |
| **Process** | 1) Provision server 2) Create DB/roles 3) Restore `pg_dump` from Stage A UAT/prod-like 4) Run pending migrations 5) Switch connection string 6) Validate row counts / checksums |
| **Data concerns** | PII in flight — use encrypted channels; restrict who can download dumps; scrub non-prod; extension parity (`uuid-ossp`/`pgcrypto` etc.) |
| **Config** | Host, SSL mode require, user/password from Key Vault, pool size |
| **Complexity** | **H** |
| **Risks** | Dump/restore downtime; sequence mismatches; timezone/`timestamptz` surprises; firewall blocking ACA |

**Cutover patterns**

| Pattern | When | Downtime |
|---------|------|----------|
| Dump/restore maintenance window | MVP scale (~500 employees) | **Estimate:** under 2–4 hours feasible with rehearsal |
| Logical replication | If near-zero downtime mandated later | Higher complexity |

**Assumption:** Maintenance window acceptable for first production Azure move.

---

### 3.5 Object storage (local / MinIO → Blob)

| Field | Content |
|-------|---------|
| **Current** | Local disk or MinIO buckets |
| **Azure** | Azure Blob containers |
| **Process** | Create storage account + containers; `azcopy` / SDK sync from MinIO/filesystem; verify object counts; flip adapter to `AzureBlobStorage`; invalidate old signed URLs |
| **Data concerns** | Salary letters / ID scans — treat transfer as confidential; enable soft delete |
| **Config** | Account, container names, MI or connection string in KV |
| **Complexity** | **M** |
| **Risks** | Broken keys if path convention changes; public container misconfig; incomplete sync |

**Key convention:** keep `/{tenant_id}/{doc_id}/...` stable across adapters.

---

### 3.6 Email (Mailpit → real provider)

| Field | Content |
|-------|---------|
| **Current** | Mailpit SMTP |
| **Azure** | ACS Email **or** corporate SMTP relay |
| **Process** | Provision sender domain / obtain SMTP; update `IEmailSender`; send test to HR DL; monitor bounces |
| **Data concerns** | Email may contain PII — avoid unnecessary fields in templates |
| **Config** | SMTP host/user/pass or ACS connection; from-address |
| **Complexity** | **L**–**M** (domain auth DNS can be **M**) |
| **Risks** | SPF/DKIM fail; emails to spam; Mailpit-only bugs undiscovered |

---

### 3.7 Redis (if used)

| Field | Content |
|-------|---------|
| **Current** | Optional Compose Redis |
| **Azure** | Azure Cache for Redis **or** remove dependency |
| **Process** | Prefer **eliminate** need before migrating; else provision cache and switch connection |
| **Data concerns** | Cache must not hold unencrypted secrets; sessions better in PG if possible |
| **Config** | Redis URL/SSL |
| **Complexity** | **L** if removed; **M** if kept |
| **Risks** | Hidden coupling discovered late |

---

### 3.8 Secrets

| Field | Content |
|-------|---------|
| **Current** | `.env` / Compose env |
| **Azure** | Key Vault + Managed Identity |
| **Process** | Inventory secrets → create KV items → grant ACA MI get/list → remove plaintext from pipeline logs |
| **Data concerns** | JWT signing key rotation plan; old tokens invalid on hard rotate |
| **Config** | KV URI; secret names |
| **Complexity** | **M** |
| **Risks** | Missing secret on deploy; over-broad RBAC on KV |

---

### 3.9 Authentication (local → Entra optional)

| Field | Content |
|-------|---------|
| **Current** | Local JWT/refresh |
| **Azure** | Same first; then Entra OIDC app registration |
| **Process** | B0: lift-and-shift local auth. B1: register app; add OIDC provider; link `entra_oid`; pilot with IT users; then HR; then all |
| **Data concerns** | Duplicate users; email match collisions |
| **Config** | Client ID/tenant ID/secret or federated credentials; redirect URIs |
| **Complexity** | **M**–**H** for SSO cutover |
| **Risks** | Lockout; Conditional Access surprises; group mapping errors |

---

### 3.10 Observability

| Field | Content |
|-------|---------|
| **Current** | stdout JSON / optional local OTel |
| **Azure** | Application Insights + Monitor alerts |
| **Process** | Add connection string / OTel exporter; create alert rules; dashboard for 5xx and dependency failures |
| **Data concerns** | Scrub PII from logs/spans (no national IDs in log props) |
| **Config** | `APPLICATIONINSIGHTS_CONNECTION_STRING` |
| **Complexity** | **L**–**M** |
| **Risks** | Log volume cost (**do not invent numbers** — measure); PII leakage in traces |

---

### 3.11 CI/CD

| Field | Content |
|-------|---------|
| **Current** | GitHub Actions free tier build/test |
| **Azure** | Same + `azure/login` OIDC + deploy ACA |
| **Process** | Create Entra app for GHA OIDC; federated credential; least-privilege role on RG |
| **Data concerns** | No prod dumps in CI artifacts |
| **Config** | Azure client/tenant/sub IDs; ACR name |
| **Complexity** | **M** |
| **Risks** | Over-privileged SP; free-tier minute exhaustion |

---

### 3.12 Messaging (in-process → Service Bus later)

| Field | Content |
|-------|---------|
| **Current** | In-process events + outbox |
| **Azure** | Keep initially; add Service Bus when integration durability requires |
| **Process** | Introduce publisher adapter behind interface; dual-publish optional; consumers migrate one-by-one |
| **Data concerns** | Poison messages; PII in bus payloads — minimize |
| **Config** | Connection / MI to namespace |
| **Complexity** | **M**–**H** when adopted |
| **Risks** | Premature adoption adds cost/complexity without benefit |

---

### 3.13 Networking / DNS / TLS

| Field | Content |
|-------|---------|
| **Current** | localhost ports |
| **Azure** | Custom domain on ACA/SWA; platform certs |
| **Process** | DNS CNAME; bind domain; update SPA/API URLs; HSTS |
| **Data concerns** | Cookie domain if any cookies used |
| **Config** | Public URLs |
| **Complexity** | **L**–**M** |
| **Risks** | DNS TTL delays; cert binding lag |

---

## 4. Suggested sequence

```text
1. Non-prod Azure RG + ACR + PG + Blob + KV + ACA (empty)
2. Deploy API to non-prod; connect empty PG; run migrations
3. Restore scrubbed data; sync sample documents
4. Point test SPA; UAT on Azure non-prod
5. Observability + alerts green
6. Production Azure resources
7. Maintenance window: freeze writes → final dump/sync → switch DNS → verify → unfreeze
8. Decommission Compose prod-like hosts (keep local dev Compose forever)
9. Later: Entra SSO, Service Bus, private networking
```

---

## 5. Data validation checklist

| Check | Method |
|-------|--------|
| Row counts | Per-table counts by `tenant_id` |
| Orphan FKs | Constraint validation |
| Document integrity | Spot-check N files hash |
| Auth | Login + refresh + sample approve flow |
| Email | Test message to controlled inbox |
| Backup | Azure PG restore drill to new server |

---

## 6. Rollback

| Scenario | Action |
|----------|--------|
| Azure API unhealthy | DNS back to previous environment if still live; or scale old Compose |
| Data corruption on cutover | Restore PG from pre-cutover dump; rehydrate blobs from pre-sync snapshot |
| SSO misconfig | Disable OIDC provider flag; local auth remains |

**Assumption:** Keep previous environment read-only for ≥ 1 week post-cutover.

---

## 7. Complexity heatmap (summary)

| Component | Complexity |
|-----------|------------|
| SPA | L–M |
| API/ACA | M |
| PostgreSQL | H |
| Blob sync | M |
| Email | L–M |
| Key Vault | M |
| Entra SSO | M–H |
| Service Bus | M–H (later) |
| AKS | Rejected |

---

## 8. Open assumptions

1. Maintenance window allowed for PG cutover.  
2. Corporate SMTP vs ACS Email — IT decision.  
3. Static Web Apps vs Blob static — pick in Sprint before Stage B.  
4. Whether production Compose ever hosts real PII (prefer **no**).  

---

*Owner: DevOps + Solution Architect. Rehearse at least once on non-prod.*
