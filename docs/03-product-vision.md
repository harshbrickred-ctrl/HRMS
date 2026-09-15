# 03 — Product Vision

**Product:** PeopleOS (working title) — internal HRMS for a ~500-employee India IT consultancy  
**Related:** [00-README](00-README.md) · [04-business-requirements](04-business-requirements.md) · [05-product-requirements-mvp](05-product-requirements-mvp.md)  
**Audience:** CEO, HR Head, Product/BA, Engineering Lead  
**Status:** Vision lock for MVP freeze (validate Assumptions in discovery)

---

## Evidence labels

| Label | Meaning |
|-------|---------|
| **Fact** | Stated company input or verifiable from cited public sources |
| **Assumption** | Planning premise; validate with stakeholders |
| **Estimate** | Engineering/capacity judgment; not accounting precision |
| **Metric-to-measure** | Outcome to measure after go-live; no invented ROI |

---

## 1. Business case themes (Part 1 summary)

These themes feed the CEO proposal ([01-executive-proposal](01-executive-proposal.md)). This document does **not** invent financial ROI.

### 1.1 Why build an internal HRMS now

| Theme | Statement | Label |
|-------|-----------|-------|
| Incumbent fragmentation | Company currently uses **greytHR** for HR operations; leadership wants tighter control over leave/attendance/workflows, documents, and operational reporting while **keeping payroll** outside the MVP build. | **Fact** (company input) |
| Ownership of core people data | Owning Core HR + leave + attendance + documents reduces dependency on vendor UX/process constraints for day-to-day workforce operations. | **Assumption** |
| Integration posture | A modular NestJS + React + PostgreSQL platform with OpenAPI enables controlled exports to payroll and future systems without rewriting domains. | **Fact** (stack locked) |
| Capacity realism | 4 engineers × 12 weeks is a hard constraint; MVP must replace *parts* of greytHR, not the entire market suite. | **Fact** / **Estimate** |
| Future optionality | Schema and tenancy hooks (`tenant_id`) prepare for later Azure and possible multi-tenant SaaS **without** funding SaaS features in MVP. | **Assumption** |

### 1.2 Problems an integrated platform addresses

| Area | Business case theme | Label |
|------|---------------------|-------|
| Spreadsheet / side-channel work | Leave balances, attendance corrections, and document checklists often spill into email/Excel when tools feel slow or opaque. | **Assumption** (validate in discovery) |
| Visibility | Managers and leadership need reliable headcount, leave liability signals, and attendance exception views—not only transactional screens. | **Assumption** |
| Workflow & audit | Approvals, escalations, and “who changed what” must be first-class for India IT compliance culture and client audit readiness. | **Assumption** |
| Employee experience | ESS should make apply-leave / mark-attendance / find-policy / download-letter low-friction on desktop and responsive mobile browsers. | **Assumption** |
| Migration path | greytHR CSV/export-based migration must be planned so cutover does not freeze HR operations. | **Fact** (migration in P0) |

### 1.3 Benefit categories (qualitative — measure later)

| Stakeholder | Expected benefit themes | Metric-to-measure (examples) |
|-------------|-------------------------|------------------------------|
| Employees | Faster self-service; clearer leave/attendance status; fewer “where is my form?” loops | Time-to-complete leave request; ESS task completion rate; ticket volume on “how do I…” |
| Managers | Single approvals inbox; team leave/attendance visibility | Approval cycle time; overdue approvals; correction reopen rate |
| HR | Master data quality; fewer manual reconciliations; document completeness | Data-quality defect rate; open correction backlog; document compliance % |
| Leadership | Operational reports without waiting for ad-hoc extracts | Report freshness; request-to-report lead time |
| IT / Security | Controlled access, audit trail, Dockerized deploy, CI | Auth incidents; failed login trends; deploy success rate |
| Finance / Payroll coordination | Cleaner attendance/leave inputs for downstream payroll (still in greytHR initially) | Export reject rate; payroll input exception count |

**Do not claim** cost savings, productivity %, or market ROI without measured baselines.

### 1.4 Strategic value of owning the platform

| Value | Notes | Label |
|-------|-------|-------|
| Process fit | Encode consultancy-specific approval chains, locations, and billable-team norms. | **Assumption** |
| Data gravity | Become system of record for employment, leave, attendance, documents. | **Assumption** |
| SaaS optionality | Later commercialize *only if* internal product-market fit and ops maturity exist. | **Assumption** |
| Risk of build | Opportunity cost vs configuring greytHR further; mitigation = ruthless P0 scope. | **Estimate** |

---

## 2. Problem statement summary (Part 2 condensed)

Detailed role/process mapping lives in [04-business-requirements](04-business-requirements.md). Summary for vision alignment:

### 2.1 Current-state pattern (India IT consultancy on greytHR)

| Domain | Typical pain pattern | Label |
|--------|----------------------|-------|
| Employee master | Duplicate or stale org/reporting data; transfer/promotion history hard to reconstruct | **Assumption** |
| Leave | Policy edge cases (encashment, sandwich rules, LOP) unclear; balance disputes | **Assumption** |
| Attendance | Marking vs import mismatches; corrections slow; manager visibility lag | **Assumption** |
| Documents | Scattered drives/email; access control weak; retention unclear | **Assumption** |
| Workflow | Email approvals; no consistent escalation; audit gaps | **Assumption** |
| Reporting | Operational reports require HR extract + Excel | **Assumption** |
| Recruitment / ATS | Parallel tools or spreadsheets; not MVP replacement of full ATS | **Assumption** |
| Payroll | Must remain accurate; **do not** rebuild Indian statutory payroll in 12 weeks | **Fact** (locked decision) |

### 2.2 Problem → MVP response (one-line)

| Problem cluster | MVP response |
|-----------------|--------------|
| Who works here & under whom | Core HR + org structure + employment records |
| Can I take leave / what’s my balance | Leave policies, balances, requests, workflow |
| Was I present / fix a miss | Attendance mark/import + corrections + workflow |
| Who approved what | Workflow v1 + audit events |
| Where is my letter / ID proof | Documents + RBAC |
| Notify me | Email + in-app notifications |
| Cut over from greytHR | CSV migration playbooks + dry runs |
| Ship safely | Docker, OpenAPI, CI, security baseline |

---

## 3. Vision, mission, principles, differentiators

### 3.1 Vision

**PeopleOS is the trusted operating system for our people’s work life in India—clear, auditable, and fast for employees and managers—while staying deliberately incomplete where specialized products (especially payroll) already win.**

### 3.2 Mission

Deliver, in **12 weeks** with **4 engineers**, a production-ready internal platform that becomes the **system of record** for identity/RBAC, Core HR, leave, attendance, documents, ESS/manager experiences, notifications, audit, and operational reports—migrated from greytHR where agreed—and designed so Azure hosting and future multi-tenant SaaS do not require a domain rewrite.

### 3.3 Product principles

| # | Principle | Implication for MVP |
|---|-----------|---------------------|
| P1 | **Truth over features** | Prefer correct leave/attendance math and audit over breadth. |
| P2 | **Employee minutes matter** | Reduce click-depth for apply / approve / correct. |
| P3 | **Manager inbox first** | Approvals are a product surface, not buried menus. |
| P4 | **HR is operator, not form-filler** | Bulk import, search, and exception queues over one-by-one chrome. |
| P5 | **Integrate payroll, don’t fake it** | Export/coordinate; no full statutory engine. |
| P6 | **Security is default** | RBAC, least privilege, audit on sensitive actions. |
| P7 | **SaaS-ready schema, not SaaS product** | `tenant_id`, modular domains; no billing/SCIM/AI in MVP. |
| P8 | **Evidence over narrative** | Label Fact / Assumption / Estimate; measure after launch. |
| P9 | **Kill feature creep** | P1/P2 stay out of committed release unless capacity remains. |
| P10 | **Migration is a feature** | Cutover tooling and reconciliation are P0. |

### 3.4 Strategic differentiators (internal first; SaaS later optional)

Differentiation is ranked relative to **table stakes** of modern HRMS (see §4). For *this company*, “differentiation” means **better operational fit and UX** than the current greytHR-centered workflow—not claiming global product superiority.

| Differentiator | Why it matters here | Horizon |
|----------------|---------------------|---------|
| Configurable workflow v1 with escalation | Consultancy approval chains vary by dept/location | P0 |
| Attendance import + correction as first-class | IT firms often mix biometric/export + WFH marking | P0 |
| Document access with RBAC + audit | Client/security audits need evidence | P0 |
| OpenAPI-first modular monolith | Internal integration & future SaaS | P0 foundation |
| Ruthless India-IT scope (no multi-country, no payroll engine) | Avoids 12-week failure mode | P0 strategy |

---

## 4. Employee lifecycle: Candidate → Alumni

**Fact:** Full lifecycle is the *product north star*.  
**Fact:** MVP implements only the bold segments below as committed scope.  
**Assumption:** Remaining stages remain in greytHR, Excel, or deferred modules until P1/P2.

```text
Candidate ──► Recruitment ──► Offer ──► Preboarding ──► Onboarding
                                                          │
                                                          ▼
                                                     Employee
                                ┌─────────────────────────┼─────────────────────────┐
                                ▼                         ▼                         ▼
                           Attendance                   Leave                 Documents / ESS
                                │                         │                         │
                                └────────────┬────────────┘                         │
                                             ▼                                      │
                                      Workflow + Audit ◄────────────────────────────┘
                                             │
                         Payroll coordination (export / keep greytHR payroll)
                                             │
                    Performance / LMS / Expenses / Assets / Helpdesk (deferred)
                                             │
                                    Promotion / Transfer (Core HR light)
                                             │
                                        Offboarding (light)
                                             │
                                           Exit
                                             │
                                          Alumni
```

| Stage | MVP (P0) | Stretch (P1) | Deferred (P2) |
|-------|----------|--------------|---------------|
| Candidate / Recruitment | Out of committed scope | Light ATS | Full ATS / careers site |
| Offer / Preboarding | Manual / HR process outside or light Core HR hire | Onboarding checklists | Offer automation |
| Onboarding | Create employee + docs upload | Checklists, asset assign | Full journey orchestration |
| Employee (Core HR) | **In** | — | Advanced org analytics |
| Attendance | **In** (mark/import + corrections) | — | Biometric farms, geofencing advanced |
| Leave | **In** | — | Complex encashment products |
| Payroll coordination | **Export stub / process** | Deeper integration | Full Indian payroll engine |
| Performance / Development | Out | — | Full PMS / LMS |
| Assets / Requests / Expenses | Out | Asset assign; simple helpdesk | Expenses, advanced service desk |
| Offboarding / Exit / Alumni | **Light** (status, access flag, checklist notes) | Stronger checklists | Alumni portal, alumni CRM |

---

## 5. Differentiation ranking table

Use this to prevent building “experimental” items under MVP pressure.

| Rank | Category | Meaning | Examples for PeopleOS | MVP? |
|------|----------|---------|----------------------|------|
| 1 | **Table stakes** | Users expect these; missing them blocks adoption | Login/SSO-ready auth path, RBAC, employee profile, leave apply/approve, attendance view, basic ESS, email notify, audit log, operational reports, mobile-responsive web | **Yes (P0)** |
| 2 | **Competitive improvements** | Do *noticeably better* than common greytHR / mid-market friction | Approvals inbox UX; attendance correction workflow; document permissions clarity; OpenAPI; migration dry-run tooling; low click-depth ESS | **Yes (P0 focus)** |
| 3 | **Strategic** | Builds durable advantage or SaaS thesis later | Workflow engine evolution; tenant-ready schema; Azure-ready deploy story; domain modularity | **Foundation in P0; depth later** |
| 4 | **Experimental** | High uncertainty / hype; do not fund in 12 weeks | AI agents, WhatsApp bots, advanced BI lake, native mobile apps, SCIM, multi-country compliance packs, full payroll engine | **No (P2)** |

### 5.1 Explicit non-goals (vision guardrails)

| Non-goal | Rationale |
|----------|-----------|
| Full Indian statutory payroll | Complexity + compliance risk exceeds 12-week capacity; keep greytHR payroll |
| Native iOS/Android apps | Responsive web first |
| Multi-country payroll/HR packs | India-only MVP (**Fact**) |
| Billing / metering / self-serve SaaS admin | Premature commercialization |
| SCIM / full IdP marketplace | Post-internal validation |
| AI agents writing HR decisions | Experimental; governance unfinished |
| Replace greytHR entirely on day 1 | Phased replacement of modules |

---

## 6. Success definition (vision-level)

| Horizon | Success looks like | Label |
|---------|--------------------|-------|
| Week 12 | Pilot cohort uses ESS leave + attendance + manager approvals; HR operates Core HR + docs; audit on; migration dry-run passed | **Estimate** (plan target) |
| +90 days | greytHR no longer SoR for Core HR/leave/attendance/docs (payroll may remain) | **Assumption** |
| Product health | Defect escape rate and approval SLA trending to agreed targets | **Metric-to-measure** |
| Experience | Employee CSAT / CES on ESS flows measured | **Metric-to-measure** |

---

## 7. Traceability

| Vision element | Downstream docs |
|----------------|-----------------|
| Business case themes | 01, 04, 29 |
| Problem summary | 04, 05 |
| Lifecycle / priorities | 05, 06, 11 |
| Differentiation ranks | 02, 05, 28 |
| Principles | 09, 14, 30 |

---

*Document owner: Product/BA + Lead Architect. Next review: end of discovery (Weeks 1–2).*
