# ADR-007 - API Strategy: Versioned REST

**Status:** Accepted  
**Date:** 2026-09-14  
**Deciders:** Solution Architect, Backend, Frontend  
**Related:** [13-api-specification](../13-api-specification.md), ADR-001

---

## Context

SPA and future integrations (payroll export, possibly mobile) need a stable HTTP API. Team familiarity and OpenAPI tooling matter more than cutting-edge RPC for this HRMS.

## Options

1. **Versioned REST** (`/api/v1/...`) + OpenAPI.  
2. **GraphQL** as primary API.  
3. **gRPC** between clients and server.  
4. **Unversioned REST** -we-ll never break it.-  
5. **JSON:API / OData** heavy standards.

## Decision

Expose a **versioned REST JSON API** (`/api/v1`), documented with **OpenAPI**. Prefer resource-oriented endpoints; use RPC-style only for genuine actions (`POST .../approve`). BFF aggregation optional inside monolith-not a separate service.

## Rationale

- NestJS + React ecosystem fits REST/OpenAPI well (**Fact**).  
- Versioning allows additive evolution without stealth breaks.  
- GraphQL adds caching/authz complexity for little MVP gain (**Estimate**).  
- gRPC poor fit for browser SPA without gateway.

## Consequences

**Positive:** Clear contracts; generated clients possible; easy gateway later.  
**Negative:** Over-fetch risk on some screens-mitigate with query params/sparse fields carefully.  
**Follow-ups:** Breaking changes ? `/v2`; deprecation headers; idempotency keys on approvals.
