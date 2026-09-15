# ADR-009 - Initial Zero-Cost Architecture

**Status:** Accepted  
**Date:** 2026-09-14  
**Deciders:** Solution Architect, Engineering Lead  
**Related:** [18-zero-cost-architecture](../18-zero-cost-architecture.md), ADR-005, ADR-012

---

## Context

Budget before product validation should not be spent on idle cloud. Engineers need a reproducible local stack and free-tier CI while preserving Azure portability.

## Options

1. **Docker Compose + PostgreSQL + local/MinIO + Mailpit + optional Redis + GitHub Actions free tier.**  
2. **Develop directly against Azure from week 1.**  
3. **Kubernetes local (kind/k3d) mimicking AKS.**  
4. **Fully unmanaged binaries without Compose.**

## Decision

Adopt **Stage A zero/minimal-cost architecture**: Compose-based NestJS + React + PostgreSQL, **local or MinIO** storage, **Mailpit**, **Redis optional**, **GitHub Actions free tier**. Distinguish free OSS vs free tier vs trial vs paid per [18](../18-zero-cost-architecture.md).

## Rationale

- Locked infra Phase 1 (**Fact**).  
- Maximizes feature learning per rupee/dollar of infra.  
- Compose maps cleanly to containers on Azure later.  
- Avoids AKS learning tax.

## Consequences

**Positive:** Fast onboarding; offline-capable; CI without cloud dependency.  
**Negative:** Not production-durable for real PII; free-tier CI limits; license checks (Docker Desktop/MinIO).  
**Follow-ups:** Abstractions for storage/email/secrets; scrubbed datasets; exit criteria before Stage B.
