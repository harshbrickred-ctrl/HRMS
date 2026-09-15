# 15 — Multi-Tenant SaaS Readiness

---

## 1. Model comparison

| Model | Security isolation | Cost | Scale | Ops | Backup/restore | Compliance story | Verdict |
|-------|--------------------|------|-------|-----|----------------|------------------|---------|
| Shared DB / Shared schema | Weakest isolation; strong app filters required | Lowest | Highest density | Easiest | Complex per-tenant restore | Needs controls evidence | **MVP + early SaaS** |
| Shared DB / Separate schema | Better isolation | Mid | Mid | Migrations painful | Easier schema dump | Better | Optional later |
| DB per tenant | Strong | Highest | Limited by ops | Hard | Clean | Strongest | Enterprise tier later |
| Hybrid | Flexible | Mid–high | Flexible | Complex | Mixed | Flexible | After product-market fit |

---

## 2. Decision

**Shared database, shared schema, mandatory `tenant_id` on all tenant-scoped tables**, enforced in repository layer + automated tests that fail if filter missing.

MVP runs with a **single tenant** row (the company). Commercial SaaS activates multiple tenants without schema rewrite.

---

## 3. Core tenancy entities

| Entity | Purpose | MVP |
|--------|---------|-----|
| Tenant | Isolation root | Yes (one row) |
| Organization | Legal entity / brand under tenant | Yes (simple) |
| User | Login identity | Yes |
| Role / Permission | Authz | Yes |
| Employee | Person record | Yes |
| Policy | Leave etc. | Yes |
| Workflow | Definitions | Yes |
| FeatureFlag | Gradual rollout | Yes light |
| AuditEvent | Security/compliance | Yes |
| Subscription | Commercial plan | **Deferred** |
| TenantBranding | Logos/colors | Deferred |

---

## 4. Engineering rules

1. No query without tenant scope (except truly global catalog tables).  
2. Cross-tenant access impossible via API (integration tests).  
3. Background jobs carry tenant context.  
4. File keys prefixed `tenant/{id}/...`.  
5. Cache keys prefixed by tenant.

---

## 5. What not to build yet

Billing, metered usage, self-serve signup, reseller portals, per-tenant custom domains — see [28-saas-roadmap.md](28-saas-roadmap.md).
