# ADR-004 - Authorization: RBAC + Resource Policies

**Status:** Accepted  
**Date:** 2026-09-14  
**Deciders:** Solution Architect, Product  
**Related:** [14-security-architecture](../14-security-architecture.md), [15-multi-tenant-strategy](../15-multi-tenant-strategy.md)

---

## Context

HR systems fail when authorization is only -role = admin.- Managers must act on **their team**; employees on **self**; HR on broader scopes. Document and salary-adjacent files need stricter checks than generic CRUD.

## Options

1. **RBAC only** (roles ? permissions).  
2. **RBAC + resource policies** (relationship/ABAC-light).  
3. **ReBAC graph** (Zanzibar-style) from day one.  
4. **Implicit checks scattered in controllers.**

## Decision

Implement **RBAC** (roles, permissions) **plus resource policies** (self, manager-of, document ACL, tenant scope). Centralize in Nest guards/policy handlers-not ad hoc controller ifs.

## Rationale

- RBAC alone cannot express -manager of requester.-  
- Full ReBAC is heavy for 12-week MVP (**Estimate**).  
- Policies compose with `tenant_id` isolation.  
- Auditable permission codes support SaaS later.

## Consequences

**Positive:** Clear permission catalog; testable policies; safer documents.  
**Negative:** Policy matrix needs product grooming; risk of inconsistent checks if bypassed.  
**Follow-ups:** Publish permission list in API docs; mandatory tests for IDOR on leave/documents; no cross-tenant admin UI in MVP.
