# 04 — Business Requirements Document (BRD)

**Product:** PeopleOS  
**Related:** [03-product-vision](03-product-vision.md) · [05-product-requirements-mvp](05-product-requirements-mvp.md) · [06-srs-functional](06-srs-functional.md)  
**Audience:** CEO, HR Head, BA, Engineering Lead  
**Scope:** Business needs for replacing *parts* of greytHR (Core HR, leave, attendance, docs, ESS/manager, workflow, audit, reports). Payroll engine **out of scope**.

---

## Evidence labels

**Fact** | **Assumption** | **Estimate** | **Metric-to-measure** — see [00-README](00-README.md).

---

## 1. Business context

| Item | Value | Label |
|------|-------|-------|
| Organization | ~500-employee India IT consultancy | **Fact** |
| Geography | India-only for MVP | **Fact** |
| Incumbent | greytHR | **Fact** |
| Build window | 4 engineers × 12 weeks | **Fact** |
| Stack | NestJS + React + PostgreSQL modular monolith | **Fact** |
| Payroll | Keep / integrate greytHR payroll initially; no full engine | **Fact** |

### 1.1 Business objectives

1. Establish PeopleOS as system of record for employee master, leave, attendance, and HR documents.  
2. Reduce email/Excel side processes for approvals and corrections.  
3. Provide ESS and Manager portals that staff will actually use.  
4. Provide operational reporting and full auditability of sensitive changes.  
5. Migrate agreed datasets from greytHR via CSV with reconciliation.  
6. Ship with Docker, OpenAPI, and CI suitable for later Azure move.

**Metric-to-measure (examples):** leave request cycle time; attendance correction backlog age; % employees with complete mandatory documents; approval SLA breach rate; migration reconciliation mismatch count.

---

## 2. Current-state pain by role

Pains below are **Assumptions** grounded in common India IT + mid-market HRMS patterns and this company’s greytHR context; validate in stakeholder interviews (Weeks 1–2).

### 2.1 CEO

| Pain | Why it hurts | Desired outcome |
|------|--------------|-----------------|
| Headcount and attrition visibility depends on HR extracts | Decision latency | Self-serve operational snapshots |
| Unclear leave liability / attendance discipline signals | Weak governance narrative | Exception dashboards, not vanity BI |
| Tool spend vs control trade-off opaque | Hard to prioritize build vs buy | Clear module ownership roadmap |

### 2.2 HR Head

| Pain | Why it hurts | Desired outcome |
|------|--------------|-----------------|
| Policy exceptions handled in email | Inconsistent decisions | Configurable policies + audited overrides |
| Cross-module reconciliation (leave ↔ attendance ↔ payroll inputs) | Month-end fire drills | Single SoR + clean export |
| Document compliance uneven | Audit / client risk | Completeness tracking |
| Change management for any new system | Adoption risk | Simple ESS + training plan |

### 2.3 HR Executive

| Pain | Why it hurts | Desired outcome |
|------|--------------|-----------------|
| Master data updates repetitive | Errors, backlog | Fast search, bulk import, effective-dated changes |
| Leave balance disputes | Trust erosion | Transparent ledger + policy engine |
| Attendance mismatches | Manual correction load | Correction workflow with evidence |
| Chasing approvals | Delay | Escalation + reminders |

### 2.4 Recruiter

| Pain | Why it hurts | Desired outcome |
|------|--------------|-----------------|
| Candidate pipeline outside Core HR | Handoff gaps at offer→join | P1 light ATS / clear hire checklist (MVP: manual hire into Core HR) |
| Preboarding docs scattered | Day-1 unreadiness | Document pack + onboarding checklist (P1) |

### 2.5 Manager

| Pain | Why it hurts | Desired outcome |
|------|--------------|-----------------|
| Approvals buried / multi-channel | Missed SLA | Unified approvals inbox |
| Team leave calendar unclear | Staffing risk | Team leave/attendance views |
| Correction requests unclear | Conflict | Structured correction with history |

### 2.6 Employee

| Pain | Why it hurts | Desired outcome |
|------|--------------|-----------------|
| “Where do I apply / what’s pending?” | Frustration | Clear ESS home + status |
| Balance / attendance opacity | Disputes | Visible balances and attendance month view |
| Finding letters / policies hard | Support tickets | Documents library with search |

### 2.7 Finance / Payroll coordination

| Pain | Why it hurts | Desired outcome |
|------|--------------|-----------------|
| Late / unclean attendance & LOP inputs | Payroll rework (in greytHR) | Period lock + export quality |
| Unclear who authorized exceptions | Audit issues | Workflow + audit trail |

### 2.8 IT

| Pain | Why it hurts | Desired outcome |
|------|--------------|-----------------|
| Vendor lock on integrations/APIs | Slow change | OpenAPI, Docker, CI ownership |
| Access reviews difficult | Security risk | RBAC + audit exports |
| Identity sprawl | Support load | Central app roles mapped to jobs |

### 2.9 Leadership (dept / delivery heads)

| Pain | Why it hurts | Desired outcome |
|------|--------------|-----------------|
| Bench / leave clash with delivery | Client impact | Team availability views |
| Inconsistent people processes across units | Governance | Standard workflows with controlled exceptions |

---

## 3. Process → Pain → Operational → Business → Digital Solution

### 3.1 Employee master data

| Current process | Pain point | Operational impact | Business impact | Digital solution (MVP) |
|-----------------|------------|--------------------|-----------------|------------------------|
| Maintain employee in greytHR; side updates in Excel | Duplicate / stale fields | HR rework; wrong manager routing | Bad decisions; approval misroutes | Core HR employee profile, org tree, employment records, effective dating |
| Joiner created late | Access & leave not ready | Day-1 friction | Productivity loss | Hire flow + role provisioning hooks |
| Exit incomplete | Access lingers | Security exposure | Compliance risk | Light offboarding status + disable login flag |

### 3.2 Leave

| Current process | Pain point | Operational impact | Business impact | Digital solution (MVP) |
|-----------------|------------|--------------------|-----------------|------------------------|
| Apply in greytHR / email exceptions | Policy confusion | Disputes | Morale / attrition risk | Policy engine + balance ledger + request workflow |
| Manager approves ad hoc | No escalation | Backlog | Delivery risk | Workflow v1 + reminders |
| HR adjusts balances manually | Opaque adjustments | Trust issues | Audit findings | Audited balance adjustments |

### 3.3 Attendance

| Current process | Pain point | Operational impact | Business impact | Digital solution (MVP) |
|-----------------|------------|--------------------|-----------------|------------------------|
| Mark / biometric export / CSV | Mismatch & missing punches | Correction queue | Payroll input errors | Mark + import + validation |
| Corrections via email | Slow, unaudited | HR load | Incorrect LOP/OT signals | Correction request + approval |
| Manager lacks daily view | Surprises | Staffing gaps | Client delivery risk | Team attendance views |

### 3.4 Documents

| Current process | Pain point | Operational impact | Business impact | Digital solution (MVP) |
|-----------------|------------|--------------------|-----------------|------------------------|
| Shared drives / email | Uncontrolled copies | Search failure | Compliance gaps | Document store + metadata + RBAC |
| No retention discipline | Over/under retention | Legal ambiguity | Risk | Retention labels (**Assumption**: policy provided by HR/Legal) |

### 3.5 Approvals / workflow

| Current process | Pain point | Operational impact | Business impact | Digital solution (MVP) |
|-----------------|------------|--------------------|-----------------|------------------------|
| Email / chat approvals | No SLA, weak audit | Rework | Governance failure | Workflow instances + inbox + escalation |

### 3.6 Reporting

| Current process | Pain point | Operational impact | Business impact | Digital solution (MVP) |
|-----------------|------------|--------------------|-----------------|------------------------|
| Ad-hoc Excel | Stale numbers | Meeting prep delay | Weak oversight | Operational report set (headcount, leave, attendance exceptions) |

### 3.7 Recruitment / onboarding (mostly non-MVP)

| Current process | Pain point | Operational impact | Business impact | Digital solution |
|-----------------|------------|--------------------|-----------------|------------------|
| ATS/Excel parallel | Handoff gaps | Bad Day-1 | Early attrition risk | P1 light ATS + checklists; MVP = Core HR hire |

### 3.8 Payroll coordination

| Current process | Pain point | Operational impact | Business impact | Digital solution (MVP) |
|-----------------|------------|--------------------|-----------------|------------------------|
| greytHR payroll + manual inputs | Late attendance/leave feeds | Payroll cycle stress | Employee payment trust | Period exports / stubs; **no** statutory engine |

### 3.9 Offboarding (light)

| Current process | Pain point | Operational impact | Business impact | Digital solution (MVP) |
|-----------------|------------|--------------------|-----------------|------------------------|
| Checklist in email | Missed revoke access / asset | Security & asset loss | Financial/security risk | Status change + checklist notes; P1 assets |

---

## 4. Stakeholders & personas

Permissions listed are **business intent**; exact RBAC matrices live in SRS/security docs.

### 4.1 Persona: CEO (`P-CEO`)

| Attribute | Detail |
|-----------|--------|
| Goals | Workforce visibility; risk/compliance confidence; sensible build investment |
| Workflows | View executive operational dashboards; drill to exceptions (read-mostly) |
| Permissions | Org-wide read on operational reports; no routine HR edits |
| Dashboard | Headcount, joiners/exits (period), leave liability snapshot, attendance exception rate |
| KPIs | Report freshness; exception aging; adoption of PeopleOS vs side processes |
| Pain points | See §2.1 |

### 4.2 Persona: HR Head (`P-HR-HEAD`)

| Attribute | Detail |
|-----------|--------|
| Goals | Policy compliance; clean SoR; audit readiness; team productivity |
| Workflows | Configure leave policies; oversee exceptions; approve sensitive overrides; migration sign-off |
| Permissions | Full HR config within delegated admin; approve high-risk adjustments |
| Dashboard | Open approvals (HR queue), policy exceptions, doc compliance %, migration status |
| KPIs | Cycle times; dispute rate; doc completeness; UAT defect reopen |
| Pain points | See §2.2 |

### 4.3 Persona: HR Executive (`P-HR-EXEC`)

| Attribute | Detail |
|-----------|--------|
| Goals | Accurate employee records; clear leave/attendance queues; timely letters/docs |
| Workflows | Create/update employees; process corrections; upload docs; run ops reports; import attendance |
| Permissions | HR operational CRUD per module policies; no system admin |
| Dashboard | My queues: corrections, incomplete profiles, pending docs, import errors |
| KPIs | Queue age; data quality defects; import success rate |
| Pain points | See §2.3 |

### 4.4 Persona: Recruiter (`P-REC`)

| Attribute | Detail |
|-----------|--------|
| Goals | Smooth offer→join handoff |
| Workflows (MVP) | Provide joiner packet to HR; limited read on hiring checklist status if exposed |
| Workflows (P1) | Light ATS pipeline |
| Permissions (MVP) | Minimal; often outside system or read-only hire tracker |
| Dashboard (P1) | Pipeline stages, offer accept, pending preboarding |
| KPIs | Time-to-hire (**Metric-to-measure**); Day-1 readiness |
| Pain points | See §2.4 |

### 4.5 Persona: Manager (`P-MGR`)

| Attribute | Detail |
|-----------|--------|
| Goals | Keep team staffed; fair timely approvals |
| Workflows | Approve/reject leave & corrections; view team leave/attendance; escalate when covered |
| Permissions | Team-scoped read; approve where designated approver |
| Dashboard | Approvals inbox; team on leave today; attendance anomalies |
| KPIs | Approval SLA; team unauthorized absence rate |
| Pain points | See §2.5 |

### 4.6 Persona: Employee (`P-EMP`)

| Attribute | Detail |
|-----------|--------|
| Goals | Self-serve leave/attendance/docs without tickets |
| Workflows | Apply leave; mark attendance (if enabled); request correction; download docs; view payslip **if** linked later (out of MVP) |
| Permissions | Self + own requests; read published policies |
| Dashboard | Balances; pending requests; notifications; quick actions |
| KPIs | ESS completion time; support ticket deflection |
| Pain points | See §2.6 |

### 4.7 Persona: Department Head (`P-DEPT`)

| Attribute | Detail |
|-----------|--------|
| Goals | Delivery vs leave/attendance balance across multiple managers |
| Workflows | Read aggregated team views; occasional escalation approvals |
| Permissions | Department-scoped read; approve if in chain |
| Dashboard | Dept leave heatmap; open escalations |
| KPIs | Escalation rate; dept attendance exception rate |

### 4.8 Persona: Finance / Payroll coordinator (`P-FIN`)

| Attribute | Detail |
|-----------|--------|
| Goals | Clean period inputs for greytHR payroll |
| Workflows | Consume attendance/leave exports; flag mismatches back to HR |
| Permissions | Read exports; limited employee financial field access as policy allows |
| Dashboard | Period lock status; export history; exception list |
| KPIs | Export reject rate; days-to-close inputs |

### 4.9 Persona: IT Administrator (`P-IT`)

| Attribute | Detail |
|-----------|--------|
| Goals | Reliable deploy, identity, integrations |
| Workflows | Environment health; SSO/IdP config (as available); secret rotation process |
| Permissions | Infra + app config (non-HR data where possible) |
| Dashboard | Service health, CI status, auth error rates |
| KPIs | Uptime (**Metric-to-measure**); failed deploys |

### 4.10 Persona: System / Security / Compliance Admin (`P-SEC`)

| Attribute | Detail |
|-----------|--------|
| Goals | Least privilege; audit completeness; DPDP-aware handling (**Assumption**: legal guidance) |
| Workflows | Role reviews; audit export; access certification support |
| Permissions | Role admin; audit read; break-glass procedures |
| Dashboard | Privileged actions; anomalous access (**Estimate**: basic first) |
| KPIs | Access review completion; audit coverage of sensitive events |

### 4.11 Persona: Leadership cohort (`P-LEAD`)

| Attribute | Detail |
|-----------|--------|
| Goals | Consistent people ops supporting delivery |
| Workflows | Consume reports; sponsor process standards |
| Permissions | Broad read on operational reports |
| Dashboard | Same family as CEO with dept filters |
| KPIs | Adoption; process compliance |

---

## 5. Business rules (cross-cutting)

| ID | Rule | Label |
|----|------|-------|
| BR-ORG-001 | Every employee belongs to exactly one primary department and one primary manager at a time (matrix optional later). | **Assumption** |
| BR-EMP-001 | Employment status drives login eligibility (Active vs Exit/Disabled). | **Fact** (intent) |
| BR-LEAVE-001 | Leave cannot be approved if balance insufficient unless HR override with reason. | **Assumption** |
| BR-ATT-001 | Attendance correction requires approver and reason code. | **Assumption** |
| BR-WF-001 | Only one active approval instance per request; superseded on cancel/withdraw. | **Assumption** |
| BR-DOC-001 | Document access follows RBAC + document classification. | **Assumption** |
| BR-AUD-001 | Create/update/delete on sensitive entities emits immutable audit events. | **Fact** (P0) |
| BR-PAY-001 | PeopleOS does not compute statutory payroll in MVP. | **Fact** |

---

## 6. Constraints & assumptions

### 6.1 Constraints

| Constraint | Notes | Label |
|------------|-------|-------|
| Timebox | 12 weeks | **Fact** |
| Team | 4 engineers | **Fact** |
| Budget infra Stage A | Zero/minimal cost | **Fact** |
| India-only | No multi-country packs | **Fact** |
| No full payroll engine | — | **Fact** |

### 6.2 Assumptions to validate

| ID | Assumption |
|----|------------|
| A-01 | greytHR can export required CSVs for employees, leave balances, attendance history (depth TBD). |
| A-02 | Email gateway (SMTP/API) available for notifications. |
| A-03 | Managers are reliably populated in org data for routing. |
| A-04 | Leave policy set is finite and documentable in Weeks 1–2. |
| A-05 | Attendance sources are mark UI and/or CSV import (not biometric farm). |
| A-06 | Legal provides document retention and DPDP handling guidance before prod. |

### 6.3 Dependencies

| Dependency | Impact if late |
|------------|----------------|
| greytHR export discovery | Migration & cutover slip |
| Policy workshops | Leave engine thrash |
| SMTP / email | Notifications degrade to in-app only |
| UAT users (HR + managers + employees) | Go-live quality risk |
| CEO approval of MVP freeze | Scope churn |

---

## 7. Scope boundaries (business view)

| In scope (P0 business) | Out of scope (business) |
|------------------------|-------------------------|
| Identity/RBAC, Core HR, Leave, Attendance mark/import/corrections, Workflow v1, Documents, ESS+Manager, Notifications, Audit, Ops reports, greytHR CSV migration, Docker/OpenAPI/CI | Full payroll, PMS, LMS, expenses, advanced BI, native mobile, WhatsApp, multi-country, billing, SCIM, AI agents, biometric farms |
| Light offboarding status | Full alumni CRM |
| Payroll *coordination* exports | Statutory calculations |

P1 stretch (only if capacity): light ATS, onboarding checklists, asset assignment, simple HR helpdesk.

---

## 8. Acceptance of BRD (business)

BRD is accepted when:

1. HR Head confirms pain priorities and policy workshop plan.  
2. CEO confirms P0/P1/P2 boundaries.  
3. IT confirms identity/email/deploy constraints.  
4. Finance confirms payroll coordination interface expectations.  
5. Assumptions A-01…A-06 owners assigned.

---

*Document owner: Product/BA. Engineering validates feasibility against [05](05-product-requirements-mvp.md) and [24](24-project-plan-12-weeks.md).*
