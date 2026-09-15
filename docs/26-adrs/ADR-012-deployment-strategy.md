# ADR-012 - Deployment Strategy

**Status:** Accepted  
**Date:** 2026-09-14  
**Deciders:** Solution Architect, Engineering Lead  
**Related:** [17-devops-strategy](../17-devops-strategy.md), [20-migration-strategy](../20-migration-strategy.md), ADR-009, ADR-010

---

## Context

The team needs a two-stage deployment path: frictionless local/CI validation, then Azure hosting without adopting Kubernetes. Deployments must be repeatable and least-privilege.

## Options

1. **Stage A: Docker Compose + GitHub Actions CI; Stage B: GHA OIDC ? ACR ? Azure Container Apps; IaC (Bicep/Terraform).**  
2. **AKS + Helm from the start.**  
3. **Manual Azure Portal clicks as primary process.**  
4. **CapRover/coolify on a single VM as production.**

## Decision

**Stage A:** Developers and UAT via **Docker Compose**; **GitHub Actions** for lint/test/build on free tier.  
**Stage B:** **GitHub Actions** with **OIDC** to Azure, push to **ACR**, deploy **Container Apps** from IaC; database migrations as explicit pipeline/job steps.  
**Not chosen:** AKS, portal-only prod, or Compose-as-production for real HR PII.

## Rationale

- Aligns with ADR-009/010 and locked infra (**Fact**).  
- OIDC avoids long-lived cloud keys in CI.  
- ACA revisions support safer rollouts than ad hoc VMs.  
- Team size favors simple pipelines (**Estimate**).

## Consequences

**Positive:** Clear promotion path; rollback via ACA revision/DNS; reproducible envs.  
**Negative:** IaC skill investment; free-tier CI minutes must be monitored.  
**Follow-ups:** Protected branches; environment secrets; rehearsal of [20](../20-migration-strategy.md) cutover; document runbooks in deployment guide.

---

## ADR index (001-012)

| ADR | Title |
|-----|-------|
| 001 | Modular monolith |
| 002 | PostgreSQL |
| 003 | Authentication |
| 004 | Authorization |
| 005 | Storage |
| 006 | Multi-tenancy |
| 007 | API strategy |
| 008 | Messaging |
| 009 | Zero-cost architecture |
| 010 | Azure target architecture |
| 011 | Observability |
| 012 | Deployment strategy |
