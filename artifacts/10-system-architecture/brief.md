---
manual: true
generated: 2026-09-14
---

# System Architecture Brief — Modular Monolith

**Audience:** Engineering / Architecture / Security  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

PeopleOS is a **NestJS + React + PostgreSQL modular monolith**: clear module boundaries for SaaS evolution, **no microservices/AKS in MVP**, payroll as an integration edge, Stage A Docker/OSS then Stage B Azure Container Apps.

## Key takeaways

- **Modules:** Identity, CoreHR, Leave, Attendance, Workflow, Documents, Notifications, Reporting, Admin, PayrollIntegration (anti-corruption).
- **Auth:** local JWT + refresh, MFA-ready; Entra OIDC later via provider interface.
- **Authz:** RBAC + resource rules (self / manager chain / HR).
- **Tenancy:** shared DB/schema + mandatory `tenant_id`; single tenant runtime now.
- **Files:** `IFileStorage` → local/MinIO now, Azure Blob later.
- **Events:** in-process + outbox → Service Bus when needed.
- **Stage B:** Container Apps + Azure PostgreSQL + Blob + Key Vault + Monitor (+ Entra).
- **NFR (Estimate):** ~500 users; simple-read p95 target &lt;300ms on pilot hardware.

## Evidence labels

Architecture decisions are locked **Fact** in ADRs. Performance numbers are **Estimate**.

## Out of scope / non-claims

This brief is not the threat model or schema DDL — see security + database docs.

## Deep dive

[`../../docs/10-system-architecture.md`](../../docs/10-system-architecture.md)

## Related artifacts

- [18-zero-cost-architecture](../18-zero-cost-architecture/brief.md)
- [19-azure-target-architecture](../19-azure-target-architecture/brief.md)
- [26-adrs/ADR-001-architecture](../26-adrs/ADR-001-architecture/brief.md)
