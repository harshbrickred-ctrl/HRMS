# 28 — SaaS Roadmap (12–24 Months)

**Product:** PeopleOS  
**Audience:** CEO, Product, Architecture  
**Horizon:** 12–24 months from MVP kickoff  
**Principle:** Internal excellence first; commercialize only after proof  
**Related:** [01-executive-proposal.md](01-executive-proposal.md), [15-multi-tenant-strategy.md](15-multi-tenant-strategy.md), [29-kpis-and-cost-strategy.md](29-kpis-and-cost-strategy.md)

---

## 1. Strategic intent

Build an internal HRMS that removes process pain for a ~500-person India IT consultancy, keeps greytHR (or equivalent) for payroll, and seeds a platform that *can* become multi-tenant SaaS **without a rewrite**.

Commercial SaaS is an **option**, not a Week-1 deliverable. Premature billing, marketplace, and AI features dilute the 12-week MVP and burn a 4-person team.


| Label          | Meaning                                                                     |
| -------------- | --------------------------------------------------------------------------- |
| **Fact**       | Team size, timeline, greytHR payroll stance, modular monolith + `tenant_id` |
| **Assumption** | Internal adoption gates will precede any external pilot                     |
| **Estimate**   | Phase durations below are planning bands, not contracts                     |


---



## 2. Phase overview

```
Phase 1          Phase 2           Phase 3              Phase 4           Phase 5
Internal HRMS →  Hardening      →  SaaS Foundation  →  Commercial    →  Advanced
(~0–4 mo)        (~4–9 mo)         (~9–14 mo)           (~14–20 mo)       (~20–24+ mo)
```

Gates are **exit criteria**, not calendar optimism.

---



## 3. Phase 1 — Internal HRMS

**Objective:** Ship P0 MVP; HR + employees run daily leave/attendance/core HR on PeopleOS; payroll remains external.

### Build

- Modular monolith (NestJS + React + PostgreSQL)
- Identity, RBAC, Core HR, Leave, Attendance, Documents (basic), Workflows (minimal), Notifications (email + in-app), Audit
- Payroll **input export** only
- Single-tenant runtime; `tenant_id` in schema
- Zero/minimal infra (Docker Compose, OSS, free-tier CI)



### Explicitly do **not** build

- Multi-tenant admin console
- Billing / subscriptions
- Public API for customers
- SCIM, customer SSO sales packaging
- Custom field framework
- AI features
- Marketplace
- Full ATS, performance, LMS, expense engine



### Exit criteria

- [ ] Adoption metrics defined and instrumented ([29](29-kpis-and-cost-strategy.md))
- [ ] HR accepts cutover for in-scope modules
- [ ] No Sev-1 data leakage incidents
- [ ] greytHR payroll path still works via export/process

---



## 4. Phase 2 — Enterprise Hardening

**Objective:** Make the internal system production-trustworthy and Azure-ready.

### Build

- Azure target architecture implementation (when funded)
- Hardening: backup/restore drills, monitoring, secret management, MFA for privileged roles
- Stronger workflow (delegation, escalation, SLA)
- Reporting pack for CEO/HR/Manager
- Data quality & migration completeness from greytHR/HRIS extracts
- Assets (P1), richer document retention, HR helpdesk SLAs
- Performance & security testing; threat model refresh



### Still do **not** build

- Tenant provisioning UI for external customers
- Usage-based billing
- White-label branding engine
- Localization beyond en-IN (unless business-critical)
- Webhook platform
- AI copilots



### Exit criteria

- [ ] Azure (or approved prod) environment with backup RPO/RTO agreed
- [ ] Security baseline signed off
- [ ] Operational runbooks exist
- [ ] Internal NPS/satisfaction baseline collected (**Metric-to-measure**)

---



## 5. Phase 3 — SaaS Foundation

**Objective:** Technical multi-tenancy and operator tooling — still preferably **no** public sales until stable.

### Build

- Tenant lifecycle: provision, suspend, offboard
- Shared-schema isolation review; optional RLS
- Feature flags per tenant
- Tenant admin roles
- API keys for **first** integration partners (private)
- Webhooks (signed, retry, delivery logs) — **thin** v1
- Custom branding (logo, colors) — light
- Custom fields (constrained JSONB + validation schema) — light
- Audit export for tenant admins



### Timing guidance


| Capability      | When                          | Premature if…                        |
| --------------- | ----------------------------- | ------------------------------------ |
| Billing         | End of Phase 3 / start of 4   | Before 1–2 design partners exist     |
| SSO (SAML/OIDC) | Phase 3 for enterprise pilots | Built before internal SSO need       |
| SCIM            | Phase 3–4                     | No customer IdP demand               |
| Webhooks        | Phase 3                       | No integrator waiting                |
| Branding        | Phase 3 light                 | Full white-label theme system        |
| Custom fields   | Phase 3 light                 | Unlimited scripting/custom code      |
| Localization    | Phase 4+                      | Before India product-market fit      |
| AI              | Phase 5                       | Before clean structured data & audit |
| Marketplace     | Phase 5                       | Before stable public API + sandbox   |




### Exit criteria

- [ ] Two internal “pseudo-tenants” or one design-partner tenant in non-prod isolation test
- [ ] Tenant data isolation test suite green
- [ ] Operator can provision tenant without eng heroics

---



## 6. Phase 4 — Commercial SaaS

**Objective:** Sell carefully to a narrow ICP (e.g., mid-market India IT/services), not “everyone”.

### Build

- Billing & subscriptions (integrate Stripe/Chargebee/Zoho Billing — **buy**, don’t build ledger)
- Plan entitlements via feature flags
- Customer onboarding playbooks
- Public API + versioning policy + developer docs
- SSO packaging; SCIM if enterprise deals require
- Support tooling, status page, DPA templates
- India GST-compliant invoicing via billing vendor



### Do **not** prematurely

- Compete on statutory payroll vs greytHR/Keka (integrate instead)
- Global localization (EU/US labor packs)
- App marketplace
- Heavy AI agents



### Exit criteria

- [ ] First paying tenant (or firm pilot-to-paid conversion)
- [ ] Churn/support load within capacity of team (**Metric-to-measure**)
- [ ] Security questionnaire pack reusable

---



## 7. Phase 5 — Advanced Platform

**Objective:** Differentiation and ecosystem — only after commercial basics work.

### Candidates

- Advanced analytics / people insights
- AI assist (policy Q&A, draft letters) with human approval — never silent HR decisions
- Marketplace / integration catalog
- Deeper regional compliance packs
- Mobile apps if ESS mobile web is insufficient
- Recruitment/BGV partner ecosystem



### Guardrails

- AI outputs audited; no autonomous payroll/leave grant without policy engine
- Marketplace apps sandboxed; least-privilege tokens
- Differentiation = workflow + UX + consultancy-shaped processes — **not** “another payroll”

---



## 8. What NOT to build prematurely (summary)


| Temptation                       | Why wait                             |
| -------------------------------- | ------------------------------------ |
| Billing engine                   | Commodity; integrate when selling    |
| Full multi-region SaaS           | Ops complexity dwarfs 4-person team  |
| Custom code per tenant           | Support nightmare; use config/fields |
| Device attendance hardware stack | Integrate vendors                    |
| Statutory payroll                | High risk; greytHR/Keka win here     |
| SCIM day 1                       | No customer demand yet               |
| Webhooks day 1                   | No consumers yet                     |
| White-label everything           | Branding lite is enough early        |
| Localization platform            | en-IN first                          |
| AI chatbot on messy data         | Garbage-in risk + compliance         |
| Marketplace                      | Needs stable API + trust             |


---



## 9. Capability timing matrix


| Capability                   | Phase 1     | Phase 2  | Phase 3  | Phase 4          | Phase 5  |
| ---------------------------- | ----------- | -------- | -------- | ---------------- | -------- |
| Core HR / Leave / Attendance | ●           | ○        | ○        | ○                | ○        |
| Payroll engine               | ✕ integrate | ✕        | ✕        | optional partner | optional |
| Azure prod                   | —           | ●        | ○        | ○                | ○        |
| Multi-tenant runtime         | schema only | harden   | ●        | ○                | ○        |
| Billing                      | —           | —        | design   | ●                | ○        |
| SSO                          | ready hooks | internal | customer | package          | ○        |
| SCIM                         | —           | —        | pilot    | ●                | ○        |
| Webhooks                     | —           | —        | ● thin   | ○                | ○        |
| Branding                     | —           | —        | ● light  | ○                | ○        |
| Custom fields                | —           | —        | ● light  | ○                | ○        |
| Localization                 | en-IN       | en-IN    | plan     | ●                | ○        |
| AI                           | —           | —        | —        | experiment       | ●        |
| Marketplace                  | —           | —        | —        | —                | ●        |


● primary build · ○ evolve · ✕ do not build in-house

---



## 10. Funding & decision gates


| Gate | Question for CEO                                                    |
| ---- | ------------------------------------------------------------------- |
| G1   | Approve MVP build (people time, ₹0 infra target)?                   |
| G2   | Fund Azure / production hardening after internal adoption proof?    |
| G3   | Authorize SaaS foundation engineering (still may be internal-only)? |
| G4   | Authorize commercial launch / pricing / legal entity packaging?     |
| G5   | Fund AI/marketplace bets with explicit ROI measurement plan?        |


No gate → no spend on that phase’s optional scope.

---



## 11. Success signals (metrics-to-measure)

- Internal ESS weekly active users / eligible employees  
- % leave requests fully self-served (no HR email)  
- Mean leave approval cycle time  
- Sev-1/2 incident count  
- Time to provision a test tenant (Phase 3+)  
- Pilot tenant retention / paid conversion (Phase 4+)

Baselines: **TBD** after instrumentation (see [29](29-kpis-and-cost-strategy.md)).

---

*Owner: Product + Lead Architect. Revisit quarterly; do not treat this as a fixed commitment to commercialize.*