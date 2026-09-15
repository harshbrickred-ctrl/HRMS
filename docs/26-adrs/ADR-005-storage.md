# ADR-005 - Storage: Local/MinIO ? Azure Blob

**Status:** Accepted  
**Date:** 2026-09-14  
**Deciders:** Solution Architect  
**Related:** [18-zero-cost-architecture](../18-zero-cost-architecture.md), [19-azure-target-architecture](../19-azure-target-architecture.md), [20-migration-strategy](../20-migration-strategy.md)

---

## Context

HR documents (IDs, letters, optional payslip PDFs) must not live in PostgreSQL BYTEA at scale. Stage A needs zero/minimal cost; Stage B needs durable managed object storage.

## Options

1. **Filesystem local + optional MinIO in Compose; Azure Blob in Stage B** via `IObjectStorage`.  
2. **PostgreSQL BYTEA / large objects.**  
3. **MinIO in production permanently.**  
4. **Only Azure Blob from day one** (cloud cost early).

## Decision

Use an **`IObjectStorage` abstraction**: **local disk or MinIO** in Stage A; **Azure Blob Storage** in Stage B. Metadata and ACL in PostgreSQL; bytes in object store; **authz-gated signed URLs**.

## Rationale

- Keeps Stage A cost near zero (**Fact** locked stack).  
- Blob is the justified Azure equivalent (**Fact**).  
- Avoids DB bloat and backup inflation.  
- Path prefix `tenant_id/` supports multi-tenant isolation.

## Consequences

**Positive:** Portable; testable with fakes; clear security boundary.  
**Negative:** Sync complexity at migration; MinIO license must be verified.  
**Follow-ups:** Virus scan Phase 2; soft delete/versioning on Blob; never public containers.
