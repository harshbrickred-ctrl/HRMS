# ADR-010 - Azure Target Architecture

**Status:** Accepted  
**Date:** 2026-09-14  
**Deciders:** Solution Architect, Leadership (infra preference)  
**Related:** [19-azure-target-architecture](../19-azure-target-architecture.md), ADR-001, ADR-009, ADR-012

---

## Context

After internal validation, PeopleOS should run on Azure with managed data, secrets, and monitoring. Team size (~4) cannot absorb heavy platform ops. Pricing must be calculated at approval time-not invented in docs.

## Options

1. **Azure Container Apps + Azure DB for PostgreSQL + Blob + Key Vault + Monitor/App Insights; Entra later; Service Bus later.**  
2. **AKS + Ingress + node pools** as primary compute.  
3. **App Service only** without containers.  
4. **VMs + Docker Compose in production.**  
5. **Multi-cloud** from day one.

## Decision

**Stage B target:** **Azure Container Apps** (preferred over AKS), **Azure Database for PostgreSQL**, **Blob Storage**, **Key Vault**, **Azure Monitor / Application Insights**, **Entra ID** for SSO when ready, **Service Bus later**. Reject AKS unless future scale/platform staffing justifies reopening this ADR.

## Rationale

- Matches locked decisions (**Fact**).  
- Container Apps fits modular monolith HTTP API (**Estimate**: sufficient for ~500 users).  
- AKS operational overhead unjustified (**Estimate**).  
- Managed PG/Blob/KV/Monitor cover NFR gaps of Stage A.

## Consequences

**Positive:** Coherent Azure story; lower ops than AKS; clear migration from Compose.  
**Negative:** Team must learn ACA/IaC; VNet hardening may come in a second hardening phase.  
**Follow-ups:** Use Pricing Calculator at budget gate; non-prod first; no price figures in ADRs.
