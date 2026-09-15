# 01 — Executive Proposal (CEO Approval Document)

**Product working name:** PeopleOS (internal HRMS)  
**Prepared for:** CEO / Leadership  
**Decision sought:** Approve 12-week internal MVP under stated conditions  
**Reading time:** ~20–30 minutes  
**Evidence labels:** Fact · Assumption · Estimate · Metric-to-measure  
**Detail pack:** See [00-README.md](00-README.md); decisive close in [appendices/part-48-final-recommendation.md](appendices/part-48-final-recommendation.md)

---

## 1. Executive summary

We propose building an **internal HRMS** for our ~500-person India IT consultancy so that employee master data, leave, attendance, documents, and approvals run on a platform we control — while **keeping greytHR (or equivalent) for statutory payroll**.

This is **not** a project to out-payroll greytHR. greytHR and peers are strong on India payroll compliance. Our build targets **process fit, employee/manager experience, workflow control, auditability, and long-term optionality** (including a possible future SaaS path). Architecture will be a **NestJS + React + PostgreSQL modular monolith**, tenancy-ready via `tenant_id`, developed first on **zero/minimal infrastructure cost**, with **Azure only after validation**.

**Recommendation: APPROVE WITH CONDITIONS** (Section 14).

| | |
|--|--|
| **Team** | 4 engineers |
| **Time** | 12 weeks |
| **Infra cash target (Stage 1)** | ₹0 (OSS / local / free tier) |
| **Payroll engine** | Out of scope — integrate/export only |

---

## 2. Current landscape (non-technical)

The HR software market splits roughly into:

| Segment | Examples (illustrative) | What buyers get |
|---------|-------------------------|-----------------|
| Global enterprise HCM | Workday, SAP SuccessFactors, Oracle HCM | Breadth, compliance depth, long implementations, high cost |
| Mid-market international | BambooHR, Rippling, UKG variants | Strong UX/HRIS; payroll strength varies by country |
| India-focused HRMS/payroll | greytHR, Keka, Darwinbox, Zoho People, PeopleStrong | India payroll + attendance + HR modules; fast to buy |

**What the market does well:** Payroll statutory compliance (especially India specialists), packaged leave/attendance, employee portals, and — for large suites — deep configuration.

**What organizations still struggle with:** Rigid workflows, uneven UX, reporting that needs Excel exports, expensive customization, integration friction, and “we bought a suite but still run critical processes on email.”

**Assumption:** Our company today depends on greytHR plus spreadsheets/email for some coordination. Exact shadow-process inventory must be confirmed in discovery (**Metric-to-measure:** count of HR processes still completed outside the system).

**Trend:** Buyers expect mobile-friendly ESS, transparent approvals, APIs, and clearer audit trails. AI is marketed heavily; durable value still comes from **clean data and reliable workflows**.

---

## 3. Why existing products aren’t enough

We should be honest: **for India payroll, greytHR is a strong incumbent.** Building PeopleOS to “defeat greytHR payroll” would be the wrong war.

Limitations fall into different buckets:

### Vendor / product limitations

- Suites optimize for the average customer; IT-consultancy nuances (project locations, rapid org changes, custom approval chains) can be awkward.  
- Deep customization is often slow, costly, or locked behind professional services.  
- Reporting and audit exports may not match leadership’s preferred views without manual work.

### Process limitations (ours)

- Even a good vendor cannot fix unclear policies, inconsistent manager behavior, or undocumented exceptions.  
- Dual systems (HRIS + Excel + email) create duplicate entry and disputes.

### Cost limitations

- License + add-modules + implementation + change requests compound.  
- Owning a focused internal platform trades **license flexibility** for **engineering ownership cost** (people time).

### UX limitations

- Employees and managers abandon portals that feel slow or confusing — then HR becomes a ticket desk.  
- **Metric-to-measure:** % leave requests still raised via email after go-live.

### Integration limitations

- Payroll, accounting, and device attendance rarely live in one perfect box.  
- A clean **export/integration strategy** is often smarter than forcing one vendor to do everything.

**Conclusion:** We build where ownership pays off (core HR engagement, leave/attendance ops, workflows, documents, audit). We **integrate** where compliance risk is highest (payroll).

---

## 4. Opportunity

| We should… | Because |
|------------|---------|
| **Build** employee master, leave, attendance ops, approvals, documents, audit, ESS/Manager UX | Daily friction; we need control and fit |
| **Build better** approval clarity, consultancy-shaped workflows, clean reporting for leadership | Differentiation vs “another generic portal” |
| **Keep standard** directory, holidays, basic policies | Table stakes — don’t over-innovate |
| **Integrate** statutory payroll, later devices/e-sign/BGV | Specialist domains |
| **Defer** ATS, performance, LMS, expenses, AI, marketplace | 4×12 capacity reality |

Longer term, a proven internal platform *may* become a commercial product for similar India services firms — **only after** internal proof ([28-saas-roadmap.md](28-saas-roadmap.md)). That optionality is valuable; it is not the Week-1 business case.

---

## 5. Proposed solution

**PeopleOS** — internal HR platform:

- **Employee self-service:** profile (permitted fields), leave, attendance view, documents, requests, notifications  
- **Manager:** approval inbox, team leave/attendance visibility  
- **HR:** employee master, policies, corrections, HR requests, exports  
- **Admin/IT:** roles, audit, system configuration  
- **Leadership:** headcount/attrition/leave/attendance summaries  

**Technical shape (for assurance, not deep dive):** one modular application, PostgreSQL database, designed so a future multi-company SaaS tenant model does not require a rewrite. Payroll remains in greytHR; PeopleOS produces **payroll input exports**.

---

## 6. Three-month MVP

### P0 — Must have

- Login, roles, security basics, audit logging  
- Organization structure (dept, designation, location)  
- Employee records + employment history  
- Leave policies, balances, request & approval  
- Attendance (manual + CSV), holidays, shifts, period lock  
- Document upload/download with access control  
- Minimal workflow engine (leave + basic HR request)  
- Email + in-app notifications for approvals  
- Payroll **input** batch export for greytHR  
- Core operational reports  

### P1 — Should have (capacity permitting)

- Asset register & assignment  
- MFA for HR/Admin  
- Richer dashboards, delegation/escalation  
- Onboarding/offboarding checklists  

### Deferred (explicit)

- Statutory payroll engine, payslips, tax/PF/ESI computation  
- Full ATS, performance, LMS, expenses  
- Biometric device platform, e-sign product, AI agents  
- Billing, SCIM, marketplace, multi-country packs  

---

## 7. Technology strategy

### Stage 1 — Zero / minimal-cost development

- Open-source stack (NestJS, React, PostgreSQL)  
- Local/Docker environments  
- Free-tier CI where available  
- Local or MinIO file storage  
- **No Azure purchase required to build or demo**  

People cost = primary investment (4 engineers × 12 weeks).

### Stage 2 — Azure production investment (after Gate G2)

Only when internal use proves value:

- Managed PostgreSQL, app hosting, blob storage  
- Key Vault, monitoring, backup/DR  
- Optional Entra ID SSO  
- Networking/security controls appropriate to HR data  

Transition is planned as **migration of the same architecture**, not a greenfield rewrite.

---

## 8. Team & timeline

| Role | Focus |
|------|-------|
| Lead / Solution Architect | Architecture, security, critical path, ADRs |
| Backend Engineer | API, schema, leave/attendance/payroll export |
| Frontend Engineer | ESS, Manager, HR UX |
| Full-stack / QA | CI, automation, UAT support, glue features |

**12-week arc (summary):**

| Weeks | Outcome |
|-------|---------|
| 0–1 | Freeze scope, schema, auth shell, CI |
| 2–5 | Core HR + leave path usable |
| 6–8 | Attendance + documents + export |
| 9–10 | Reports, hardening, migration rehearsal |
| 11–12 | UAT, training, go-live, hypercare |

**Critical path:** MVP freeze → employee master → leave approvals → attendance/export accepted by Finance/HR → UAT sign-off.

---

## 9. Security summary

HR systems hold sensitive personal data. MVP security includes:

- Authentication and role-based access; object-level checks so employees cannot access others’ records  
- Encrypted transport; hashed passwords; secrets kept out of source control  
- Auditing of sensitive actions (exports, document downloads, approvals, master changes)  
- Controlled document storage (no public permanent links)  
- Soft-delete and retention hooks; exit disables system access promptly  

Deeper Azure controls, formal pen-tests, and SSO harden in Stage 2 / Phase 2.  
**Metric-to-measure:** Sev-1/2 security incidents; % privileged users with MFA (when enabled).

---

## 10. Business impact (metrics-to-measure — not invented ROI)

We will **not** claim unverified productivity percentages. Success is measured after baseline:

| Area | Metric-to-measure |
|------|-------------------|
| Adoption | Weekly active ESS users / eligible employees |
| Self-service | % leave requests via PeopleOS vs email |
| Speed | Median leave approval time |
| HR load | Leave/attendance-related HR tickets per month |
| Data quality | Attendance correction rate |
| Leadership | Time to produce headcount/attrition snapshot |
| Payroll coordination | Time from period close → greytHR-ready export |
| Trust | Critical incidents; access revocation time after exit |

Baselines TBD in the first month of production use ([29-kpis-and-cost-strategy.md](29-kpis-and-cost-strategy.md)).

---

## 11. Future SaaS

If PeopleOS works internally, Phases 3–5 can add true multi-tenant operations, light branding/custom fields, webhooks, then commercial billing via a **bought** billing vendor — not a homemade ledger. AI and marketplace come last.

**This proposal does not authorize commercial launch spend.** That requires later gates after adoption and hardening evidence ([28-saas-roadmap.md](28-saas-roadmap.md)).

---

## 12. Investment required

| Category | What we are asking for now |
|----------|----------------------------|
| **People** | 4 engineers × 12 weeks (primary cost) |
| **Infrastructure Stage 1** | ₹0 target — OSS, local Docker, free-tier CI |
| **Licenses** | Prefer existing org tools; no new mandatory paid SaaS for MVP |
| **Azure Stage 2** | Not funded by this approval — separate decision; cost **categories** only until quotes: compute, database, storage, networking, identity, monitoring, backup, security, messaging, support |
| **Ongoing maintenance** | Fraction of team capacity post-launch (Estimate: plan explicitly after Week 12) |
| **SaaS commercialization** | Separate business case (billing vendor, legal, support) |

---

## 13. Top risks

| Risk | Mitigation |
|------|------------|
| Scope creep into payroll/ATS/AI | Written freeze; Lead can reject scope without equal cut |
| Migration / dual-run pain with greytHR | Early export discovery; parallel period |
| Security/PII incident | AuthZ tests, audit, security baseline before UAT |
| Low adoption | UX UAT, manager training, change management |
| Team overload | Protect P0; defer P1 |
| Premature cloud/SaaS spend | Gates G2–G4 |

Full register: planned `23-risk-register.md`.

---

## 14. Recommendation

### **APPROVE WITH CONDITIONS**

Leadership should approve the internal PeopleOS MVP and Stage 1 zero/minimal-cost approach **only if** the following conditions are accepted:

1. **No statutory payroll engine** in the MVP; greytHR (or chosen payroll vendor) remains system of record for payroll; PeopleOS delivers input export/coordination only.  
2. **MVP scope freeze** (P0 / P1 / deferred) signed by HR Head and Lead Architect before Sprint 1 development.  
3. **Security baseline** (access control, audit, document protection) reviewed and accepted before user acceptance testing.  
4. **Schema v1 and core Architecture Decision Records** completed in Sprint 0.  
5. **Success measured via KPIs** with baselines — no fabricated ROI in steering materials.  
6. **Azure / production cloud spend** requires a separate Gate G2 after demonstrated internal adoption.  
7. **Commercial SaaS** is optional and requires Gates G3/G4 — not implied by approving this MVP.  
8. **Scope control:** any new P0 item must displace equal effort from the frozen list.

**If conditions 1–4 are not accepted, do not approve** — restart scoping until payroll boundary and security/architecture foundations are clear.

---

## 15. Decision & next steps

| Decision | ☐ Approve with conditions · ☐ Reject · ☐ Defer pending _____ |
|----------|----------------------------------------------------------------|
| CEO signature | |
| Date | |
| HR Head acknowledgment of MVP freeze obligation | |
| Lead Architect acknowledgment | |

**Immediate next step after approval:** First 5 working days plan in [appendices/part-48-final-recommendation.md](appendices/part-48-final-recommendation.md) §L (kickoff, freeze, compose/CI, schema, auth spike, UX/sprint board).

---

*This document is Part 47 of the enterprise blueprint. It is intentionally executive-facing; engineering depth lives in docs 10–30 and ADRs.*
