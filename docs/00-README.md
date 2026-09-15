# HRMS Enterprise Blueprint — Documentation Index

**Product working name:** Internal HRMS (working title: *PeopleOS*)  
**Organization context:** ~500-employee India IT consultancy; current system greytHR; India-only for MVP  
**Stack (locked):** NestJS + React + PostgreSQL (modular monolith)  
**Timeline:** 4 engineers × 12 weeks  
**Infrastructure:** Stage A zero/minimal-cost local; Stage B Azure after validation  

**Document status:** Foundation pack for CEO approval → discovery → build → internal adoption → future SaaS.

---

## Artifacts (quick share)

For 1–2 minute topic cards (meetings / email / onboarding), use the mirrored pack under [`../artifacts/`](../artifacts/):

- **Index:** [`../artifacts/00-INDEX.md`](../artifacts/00-INDEX.md) · open [`../artifacts/00-INDEX.html`](../artifacts/00-INDEX.html) in a browser  
- **How it works:** [`../artifacts/README.md`](../artifacts/README.md)  
- Each doc has `artifacts/<same-path>/brief.md` + `brief.html` linking back here for depth  
- Regenerate after doc edits: `node scripts/generate-doc-artifacts.mjs`

**Rule:** `docs/` remains the source of truth. Artifacts are derived views.

---

## Evidence labels (used throughout)

| Label | Meaning |
|-------|---------|
| **Fact** | Verifiable from cited public sources or stated company inputs |
| **Assumption** | Explicit planning premise; must be validated with stakeholders |
| **Estimate** | Order-of-magnitude engineering/capacity judgment; not accounting precision |
| **Metric-to-measure** | Outcome that must be measured after implementation (no invented ROI) |

---

## Reading order

### For CEO / Leadership (30–45 minutes)

1. [31-management-overview.md](31-management-overview.md) — **management presentation narrative (start here for meetings)**
2. [01-executive-proposal.md](01-executive-proposal.md) — **primary approval document**
3. [02-market-analysis.md](02-market-analysis.md) — landscape, gaps, what we will / won’t build
4. [23-risk-register.md](23-risk-register.md) — top risks
5. [29-kpis-and-cost-strategy.md](29-kpis-and-cost-strategy.md) — costs & build-vs-buy
6. [28-saas-roadmap.md](28-saas-roadmap.md) — long-term commercialization (do not fund prematurely)

### For Product / HR / BA

1. [03-product-vision.md](03-product-vision.md)
2. [04-business-requirements.md](04-business-requirements.md)
3. [05-product-requirements-mvp.md](05-product-requirements-mvp.md)
4. [06-srs-functional.md](06-srs-functional.md)
5. [07-user-stories.md](07-user-stories.md)
6. [08-process-flows.md](08-process-flows.md)
7. [09-ux-ui-specification.md](09-ux-ui-specification.md)

### For Engineering / Architecture / Security

1. [10-system-architecture.md](10-system-architecture.md)
2. [11-domain-architecture.md](11-domain-architecture.md)
3. [12-database-design.md](12-database-design.md)
4. [13-api-specification.md](13-api-specification.md)
5. [14-security-architecture.md](14-security-architecture.md)
6. [15-multi-tenant-strategy.md](15-multi-tenant-strategy.md)
7. [18-zero-cost-architecture.md](18-zero-cost-architecture.md)
8. [19-azure-target-architecture.md](19-azure-target-architecture.md)
9. [20-migration-strategy.md](20-migration-strategy.md)
10. [26-adrs/](26-adrs/) — Architecture Decision Records

### For Delivery / QA / Ops

1. [24-project-plan-12-weeks.md](24-project-plan-12-weeks.md)
2. [25-sprint-plan.md](25-sprint-plan.md)
3. [16-testing-strategy.md](16-testing-strategy.md)
4. [17-devops-strategy.md](17-devops-strategy.md)
5. [21-data-migration.md](21-data-migration.md)
6. [22-deployment-guide.md](22-deployment-guide.md)
7. [27-change-management.md](27-change-management.md)
8. [30-engineering-governance.md](30-engineering-governance.md)

### Appendices

- [appendices/competitor-matrix.md](appendices/competitor-matrix.md)
- [appendices/fr-catalog.md](appendices/fr-catalog.md)
- [appendices/capacity-sheet.md](appendices/capacity-sheet.md)
- [appendices/part-48-final-recommendation.md](appendices/part-48-final-recommendation.md)

---

## Locked decisions (do not reopen casually)

| Decision | Choice |
|----------|--------|
| Company | ~500 employees, IT consultancy, India-only, greytHR incumbent |
| Stack | NestJS + React + PostgreSQL |
| Style | Modular monolith |
| Tenancy MVP | Single tenant runtime; `tenant_id` in schema |
| Payroll | Integrate / keep greytHR payroll initially — **do not build** statutory engine |
| Infra Phase 1 | Docker Compose + OSS + free-tier CI |
| Infra Phase 2 | Azure after internal validation gates |

---

## Mandatory before development begins

| Document | Required? |
|----------|-----------|
| CEO approval (01) | Yes |
| Market-influenced MVP freeze (02, 05) | Yes |
| ADRs 001–010 (26) | Yes |
| Schema v1 (12) | Yes |
| Security baseline (14) | Yes |
| Sprint 0 backlog from stories (07, 25) | Yes |
| greytHR export discovery notes (21) | Yes |
| UX wireframes for ESS/Manager/HR (09) | Yes |

---

## Part mapping (brief request Parts 1–48)

| Parts | Primary document(s) |
|-------|---------------------|
| 1–2, 7, 40 | 03-product-vision, 04-business-requirements |
| 3–6 | 02-market-analysis, appendices/competitor-matrix |
| 8–10 | 04, 06, 07, 30 |
| 11–14 | 05, 06, 11 |
| 15–17 | 10, 18, 19, 20 |
| 18–26 | 14, 15, 11, 12, 13 + domain sections in 11 |
| 27–33 | 09, 24, 25, 16, 17 |
| 34–38 | 21, 23, 27, 22 |
| 39–45 | 28, 29, 30, 26-adrs |
| 46 | this README |
| 47 | 01-executive-proposal |
| 48 | appendices/part-48-final-recommendation |

---

## Ownership

| Role | Documents |
|------|-----------|
| Lead / Solution Architect | 10–20, 26-adrs, Part 48 |
| Product / BA (Lead + HR stakeholder) | 01–09, 27–29 |
| Backend Engineer | 12, 13, domain APIs |
| Frontend Engineer | 09, ESS/Manager UX |
| Full-stack / QA | 16, 17, 22, test traces in 06 |

---

*Last updated: documentation foundation pack for CEO approval.*
