# ADR-006 - Multi-Tenancy

**Status:** Accepted  
**Date:** 2026-09-14  
**Deciders:** Solution Architect, Product  
**Related:** [15-multi-tenant-strategy](../15-multi-tenant-strategy.md), ADR-001, ADR-002

---

## Context

Internal MVP serves one company, but leadership wants a path to commercialize as SaaS. Rewriting schemas later to add tenancy is expensive and leak-prone.

## Options

1. **Shared DB, shared schema, `tenant_id`** (single-tenant runtime MVP).  
2. **DB per tenant.**  
3. **Schema per tenant.**  
4. **No tenancy until SaaS** (single-tenant tables).

## Decision

**Shared database, shared schema, mandatory `tenant_id` from day 1**; **single tenant runtime** for MVP. Entities: Tenant, OrgUnit, User, Role, Permission, FeatureFlag; **Subscription deferred**.

## Rationale

- Lowest ops burden for Stage A/B (**Fact** preference).  
- Prevents painful retrofit (**Estimate**: weeks of risk).  
- Dual-tenant CI tests can prove isolation before SaaS.  
- Locked decision (**Fact**).

## Consequences

**Positive:** SaaS-ready data model; one migration pipeline.  
**Negative:** App bugs can cause cross-tenant leaks-must test filters; consider RLS later.  
**Follow-ups:** Global query filters; tenant in JWT `tid`; storage key prefixes; no trust of raw `X-Tenant-Id`.
