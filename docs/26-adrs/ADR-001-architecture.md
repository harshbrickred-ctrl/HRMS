# ADR-001 - Architecture Style: Modular Monolith

**Status:** Accepted  
**Date:** 2026-09-14  
**Deciders:** Solution Architect, Engineering Lead  
**Related:** [10-system-architecture](../10-system-architecture.md), ADR-010, ADR-012

---

## Context

PeopleOS must replace critical greytHR workflows (Core HR, Leave, ESS/Manager) with ~4 engineers in ~12 weeks for an internal India IT consultancy (~500 employees). The team needs clear module boundaries for future SaaS without paying the operational cost of distributed systems on day one.

## Options

1. **Modular monolith** - One NestJS deployable; modules with enforced boundaries.  
2. **Microservices** - Separate services per domain (leave, attendance, identity, -).  
3. **Distributed monolith** - Multiple repos/deployments without true independence.  
4. **Serverless function-per-endpoint** - Fine-grained Azure Functions early.

## Decision

Adopt a **modular monolith** (NestJS modules + React SPA + PostgreSQL). **No microservices** for MVP or Stage B.

## Rationale

- Matches team size and timeline (**Estimate**).  
- Single transaction model simplifies leave + workflow consistency.  
- Avoids network failure modes, distributed tracing tax, and AKS/service mesh.  
- Module boundaries + `tenant_id` preserve SaaS evolution path.  
- Locked organizational decision (**Fact**).

## Consequences

**Positive:** Faster delivery; simpler ops (Compose ? Container Apps); easier refactoring.  
**Negative:** Discipline required to prevent -ball of mud-; scaling is vertical/replica-based first.  
**Follow-ups:** Module dependency rules in [10](../10-system-architecture.md); extract services only with measured need and staffing.
