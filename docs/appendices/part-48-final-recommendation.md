# Part 48 — Final Architectural & Product Recommendation

Decisive summary for leadership and engineering. No open options.

---

## A. Recommended Architecture

**Modular monolith** on NestJS with React SPA and PostgreSQL. In-process domain events; abstract file/auth providers. **Not** microservices/AKS for MVP.

## B. Recommended Technology Stack

| Layer | Choice |
|-------|--------|
| Frontend | React + TypeScript + Vite |
| Backend | NestJS + TypeScript + Prisma |
| Database | PostgreSQL 16 |
| Auth MVP | Local JWT + refresh; MFA-ready |
| Files | Local/MinIO → Azure Blob |
| CI | GitHub Actions (free tier / self-hosted) |
| Containers | Docker Compose → Azure Container Apps |

## C. Recommended MVP (P0)

Identity/RBAC/Audit · Core HR · Leave · Attendance (+CSV) · Workflow v1 · Documents · ESS · Manager inbox · Notifications · Operational reports · greytHR CSV migration · OpenAPI · Compose stack.

## D. Explicitly Deferred

Full Indian payroll engine · Performance/LMS/Expenses · Native mobile · WhatsApp · AI agents · Billing/SCIM/marketplace · Multi-country · Biometric device cloud · AKS.

## E. Market Differentiation (future SaaS)

Workflow + ESS/Manager UX + developer-friendly APIs + audit/document control for India mid-market; **payroll via partners** (do not compete with greytHR compliance depth).

## F. Critical Path

Requirements freeze → Auth/RBAC → Employee master → Leave + Workflow → ESS approvals → Migration dry-run → Pilot. Slip on workflow/leave kills the date.

## G. Top 10 Risks

1. Scope creep  
2. 12-week overreach  
3. Payroll build temptation  
4. Workflow ambiguity  
5. greytHR data quality  
6. Security/PII incident  
7. Low adoption  
8. Unrealistic expectations  
9. Dual-system confusion  
10. Workflow engine underestimation  

## H. Initial Infrastructure Strategy

Local Docker Compose + OSS + existing SMTP/VM + GitHub Actions free-tier quotas. No Azure purchase required for MVP development.

## I. Future Azure Strategy

Container Apps + Azure PostgreSQL + Blob + Entra ID + Key Vault + Monitor (+ Service Bus when needed). Migrate via dumps/object copy/OIDC link. See [20-migration-strategy.md](../20-migration-strategy.md).

## J. SaaS Strategy

Ship internal single tenant with `tenant_id` everywhere → harden 6–12 months → enable multi-tenant commercial with billing **later**. Do not build billing in weeks 1–12.

## K. CEO Decision

**APPROVE WITH CONDITIONS** as listed in [01-executive-proposal.md](../01-executive-proposal.md).

## L. First 5 working days after approval

### Day 1
- Kickoff; confirm CEO conditions in writing  
- Name RACI; create repos (api, web, docs already)  
- Schedule HR workshops (leave/attendance/approvals)  

### Day 2
- greytHR export discovery: employees, balances, org, attendance sample  
- SoR matrix draft (what stays in greytHR)  
- Threat-model workshop (1 hour)  

### Day 3
- Sign ADRs 001–012  
- Schema v1 review from [12-database-design.md](../12-database-design.md)  
- UX wireframe session: Inbox + Leave + Employee profile  

### Day 4
- Scaffold NestJS+React+Compose skeleton  
- CI pipeline green (lint/test placeholder)  
- Draft Sprint 1 backlog in tracker  

### Day 5
- PRD/MVP freeze meeting (HR Head + Lead)  
- Baseline Metric-to-measure definitions  
- Risk R01/R04 explicit “won’t do” list published  
- Demo cadence calendar (weekly) issued  

---

**End of Part 48.**
