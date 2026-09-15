# ADR-011 - Observability: OpenTelemetry / Structured Logs ? App Insights

**Status:** Accepted  
**Date:** 2026-09-14  
**Deciders:** Solution Architect, DevOps  
**Related:** [10-system-architecture](../10-system-architecture.md), [19-azure-target-architecture](../19-azure-target-architecture.md), ADR-010

---

## Context

HR workflows fail silently without correlation across API, DB, and email. Stage A cannot rely on paid APM; Stage B should use Azure-native monitoring without rewriting instrumentation.

## Options

1. **Structured JSON logs + OpenTelemetry hooks in Stage A; Application Insights / Azure Monitor in Stage B.**  
2. **printf debugging only.**  
3. **Vendor APM trial as foundation.**  
4. **ELK self-hosted in Compose as long-term.**

## Decision

Instrument the API with **structured logs** (JSON) and **OpenTelemetry-compatible** traces/metrics from the start. In Stage B, export to **Application Insights** and alert via **Azure Monitor**. Keep **application audit table** for security-significant events (separate from APM).

## Rationale

- Portable instrumentation avoids rewrite (**Fact** OTel goal).  
- App Insights aligns with Azure target (**Fact** locked).  
- Self-hosted ELK is ops-heavy for 4 engineers (**Estimate**).  
- Trials are not a strategy.

## Consequences

**Positive:** Correlation IDs end-to-end; faster incident response on Azure.  
**Negative:** Must scrub PII from logs/spans; watch ingestion volume (measure-don-t invent cost).  
**Follow-ups:** Standard fields `tenant_id`, `user_id`, `correlation_id`; alert on 5xx and auth failure spikes.
