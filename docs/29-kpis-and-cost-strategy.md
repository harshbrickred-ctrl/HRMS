# 29 — KPIs and Cost Strategy

**Product:** PeopleOS  
**Audience:** CEO, Product, Engineering, Finance  
**Rule:** No invented ROI ₹/%; all outcomes are **Metric-to-measure** with baselines TBD  
**Related:** [01-executive-proposal.md](01-executive-proposal.md), [28-saas-roadmap.md](28-saas-roadmap.md), [18-zero-cost-architecture.md](18-zero-cost-architecture.md), [19-azure-target-architecture.md](19-azure-target-architecture.md)

---

## 1. How to read this document

| Label | Meaning |
|-------|---------|
| **Metric-to-measure** | Must be instrumented; baseline after 2–4 weeks of stable use |
| **Assumption** | Planning premise (e.g., greytHR remains payroll system of record) |
| **Estimate** | Capacity judgment, not accounting precision |
| **Fact** | Locked context (4 eng × 12 weeks; Nest/React/PG; India IT ~500) |

Do **not** use placeholder “30% productivity gain” claims in CEO materials.

---

## 2. Business KPIs

| ID | Metric-to-measure | Why it matters | Baseline | Target setting |
|----|-------------------|----------------|----------|----------------|
| B-01 | HR tickets / month related to leave & attendance | Manual load | TBD | Set after 30 days |
| B-02 | % employee master updates done in-system vs email/Excel | Data centralization | TBD | — |
| B-03 | Time from join date → ESS account active (hours/days) | Onboarding speed | TBD | — |
| B-04 | Payroll input export cycle time (period close → file) | Finance coordination | TBD | — |
| B-05 | Leadership report prep time for headcount/attrition | Visibility | TBD | Survey + clock |
| B-06 | External HRMS license overlap decision (retain/reduce modules) | Cost optionality | greytHR in use | Review at Month 6 |

---

## 3. Product KPIs

| ID | Metric-to-measure | Notes |
|----|-------------------|-------|
| P-01 | WAU / eligible employees (ESS) | Adoption |
| P-02 | % leave requests submitted via ESS (not email) | Self-service rate |
| P-03 | Median leave approval time (submit → final decision) | Workflow effectiveness |
| P-04 | Attendance correction rate (% records edited after entry) | Process/data quality |
| P-05 | Onboarding checklist completion % by Day 7 / Day 30 | If checklist in scope |
| P-06 | HR request SLA attainment (% resolved by due) | Helpdesk |
| P-07 | CSAT / CES after key flows (leave, document upload) | Lightweight survey |
| P-08 | Feature adoption: documents, approvals inbox | Module use |

---

## 4. Technical KPIs

| ID | Metric-to-measure | Notes |
|----|-------------------|-------|
| T-01 | Availability (monthly uptime %) | Internal SLA TBD |
| T-02 | API p95 latency (key GETs) | e.g. employee me, leave inbox |
| T-03 | Error rate 5xx / total requests | Exclude client 4xx |
| T-04 | Build CI time & flake rate | Dev productivity |
| T-05 | Mean time to restore (MTTR) for Sev-1 | Ops readiness |
| T-06 | DB storage growth GB/month | Capacity planning |
| T-07 | Migration job success rate (greytHR extracts) | Data quality |

---

## 5. Security KPIs

| ID | Metric-to-measure | Notes |
|----|-------------------|-------|
| S-01 | Sev-1/2 security incidents (count) | Incl. data exposure |
| S-02 | Privileged accounts with MFA enabled (%) | Target 100% HR/Admin |
| S-03 | Failed login rate & lockouts | Abuse signal |
| S-04 | Time to revoke access after exit (hours) | Joiner-mover-leaver |
| S-05 | Critical vulns open > 30 days (count) | From scans |
| S-06 | Audit coverage: % sensitive actions logged | Sample review |

---

## 6. Operational KPIs

| ID | Metric-to-measure | Notes |
|----|-------------------|-------|
| O-01 | Backup restore drill success (pass/fail + time) | Quarterly |
| O-02 | On-call / interrupt hours per eng per sprint | Sustainability |
| O-03 | Change failure rate (releases causing hotfix) | DORA-ish |
| O-04 | Deploy frequency (prod) | After Azure gate |
| O-05 | Support backlog age (P1/P2 tickets) | HR + IT |
| O-06 | Training completion for managers on approvals | Change mgmt |

**Instrumentation plan:** Product events + API metrics + quarterly manual baselines where automation absent. Owners assigned in Sprint 0.

---

## 7. Cost strategy

### 7.1 Initial development — zero / minimal (Stage A)

**Target:** Infrastructure/tooling cash outlay ≈ **₹0** where reasonably achievable.

| Category | Approach | Cost class |
|----------|----------|------------|
| IDE | VS Code / Cursor existing | Existing / free |
| Backend/Frontend frameworks | NestJS, React (OSS) | Open source |
| Database | PostgreSQL local/Docker | Open source |
| Containers | Docker Desktop / Engine | Free personal or existing license — **verify org policy** |
| Object storage (dev) | Local disk or MinIO | OSS / local |
| Cache (if needed) | Redis container | OSS |
| Auth (dev) | In-house JWT | Build |
| Email (dev) | MailHog / Ethereal | Free / local |
| CI | GitHub Actions free tier / Azure DevOps existing | Free tier / existing |
| Secrets (dev) | `.env` local + git-ignore | Local |
| Monitoring (dev) | Logs + optional OSS Grafana stack | OSS |
| Domain/TLS | localhost / internal | N/A |

**Honesty rules:**

- Free tier ≠ forever free; document quotas.
- Trial ≠ free; calendar the end date.
- Never label a paid SaaS as free.
- People cost (4 engineers × 12 weeks) is the **primary** investment — track as capacity, not hidden infra.

**Cost risks in Stage A:** Docker licensing policy, CI minute overages, accidental cloud signup, proprietary connectors.

### 7.2 Internal production — cost categories (no prices)

When leadership approves internal production (may still be on-prem/VM before Azure):

| Category | Examples |
|----------|----------|
| Compute | VM or container hosts for API + web |
| Database | Managed or self-hosted PostgreSQL HA |
| Storage | Document blobs + backups |
| Networking | VPN, private DNS, TLS certs |
| Identity | Optional org IdP integration effort |
| Email delivery | Transactional email provider or relay |
| Monitoring | Log retention, uptime checks |
| Backup / DR | Snapshot storage, offsite copy |
| Security | Vulnerability scanning seats, secret vault |
| Support | On-call time (people) |

Still **do not invent ₹ figures** — obtain quotes when Gate G2 opens.

### 7.3 Azure production — cost categories (no prices)

| Azure category | Typical services (illustrative) | Purpose |
|----------------|----------------------------------|---------|
| Compute | Azure Container Apps (preferred); App Service alternate; **not** AKS for this team size | API + web |
| Database | Azure Database for PostgreSQL | Managed PG |
| Storage | Blob Storage | Documents, exports |
| Networking | VNet, Private Endpoints, App Gateway/WAF | Isolation |
| Identity | Entra ID app registrations / SSO | Enterprise login |
| Monitoring | Azure Monitor, App Insights | Telemetry |
| Backup | Azure Backup / PG backups | Resilience |
| Security | Key Vault, Defender plans as approved | Secrets & posture |
| Messaging | Service Bus / Queue Storage | Async jobs later |
| CDN / edge | Front Door / CDN if public SaaS | Phase 4+ |
| Support | Azure support plan tier | Vendor SLAs |

Migration complexity and people time dominate early Azure cost more than list prices (**Estimate**).

### 7.4 SaaS-phase cost categories (future)

Billing vendor fees, multi-tenant isolation testing, customer support, compliance attestations, status page, legal (DPA/ToS) — fund only at Gates G3–G4.

---

## 8. Build vs Buy vs Integrate

| Capability | Options considered | Recommendation | Rationale |
|------------|--------------------|----------------|-----------|
| **Payroll (statutory India)** | Build engine vs keep greytHR/Keka vs hybrid | **INTEGRATE** (keep vendor payroll) | High compliance risk; greytHR is strong here; MVP exports inputs only |
| **Attendance devices** | Build device protocol stack vs vendor SDK vs manual/CSV | **INTEGRATE** | Hardware ecosystems are specialized; CSV/API import first |
| **Auth** | Build JWT/RBAC vs Auth0/Clerk vs Entra | **BUILD** core JWT/RBAC for MVP; **INTEGRATE** Entra SSO later | Speed + cost for Stage A; SSO when Azure/enterprise gate opens |
| **Notifications** | Build templates+outbox vs full ESP platform | **BUILD** in-app + email outbox; **INTEGRATE** SMTP/ESP for delivery | Commodity sending; own domain events |
| **E-sign** | Build crypto signatures vs Digio/Leegality/DocuSign | **INTEGRATE** when legally required | Defer to post-MVP; don’t build PKI |
| **Storage** | Local/MinIO vs Azure Blob | **BUILD** abstraction; local/MinIO now, **INTEGRATE** Azure Blob at Stage B | Avoid lock-in via interface |
| **BI / analytics** | Build warehouse vs Metabase/Power BI | **BUILD** operational reports MVP; **BUY/INTEGRATE** BI tool later | Don’t build a BI platform |
| **Recruitment / ATS** | Build full ATS vs Greenhouse/Workable/Zoho Recruit | **DEFER**; later **INTEGRATE** | Out of MVP capacity |
| **BGV** | Build vs OnGrid/AuthBridge etc. | **INTEGRATE** when needed | Vendor networks required |
| **Accounting** | Build vs Tally/Zoho Books export | **INTEGRATE** (export) | Finance SoR stays external |

### Decision rule of thumb

| Choose… | When |
|---------|------|
| **BUILD** | Differentiating workflow/UX; core HR data you must own; low regulatory surface |
| **BUY** | Commodity SaaS with clear fee; not differentiating |
| **INTEGRATE** | Compliance-heavy, device, or deep specialist domain (payroll, BGV, e-sign) |

---

## 9. Investment narrative for leadership

1. **Now:** Primarily **people time** (4 × 12 weeks) + existing machines.  
2. **Infra MVP:** ₹0 target via OSS/local/free tier.  
3. **After validation:** Azure category spend + possible transactional email + backup storage.  
4. **SaaS:** Separate business case; billing vendor + support + compliance — not funded by MVP approval alone.

---

## 10. Review cadence

| Cadence | Review |
|---------|--------|
| Weekly (build) | T-02, T-03, CI health |
| Monthly (operate) | P-01–P-04, B-01, S-01 |
| Quarterly | Full KPI pack + cost category actuals vs quotes |
| Gate reviews | G2–G5 with KPI evidence |

---

*Owners: Product (business/product KPIs), Lead Architect (technical/security), Ops assignee (operational). Baselines TBD — do not fake numbers.*
