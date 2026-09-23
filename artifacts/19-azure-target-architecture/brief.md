---
manual: false
generated: 2026-09-16
---

# 19 — Azure Target Architecture (Stage B)

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Discipline: Justify each service; reject AKS unless scale/ops justify; no invented Azure prices.

## Key takeaways

- Prefer Azure Container Apps over AKS for this team size: Fact (locked preference)
- Azure Database for PostgreSQL, Blob, Entra ID, Key Vault, Monitor/App Insights: Fact (locked)
- Service Bus later: Fact (locked)
- User scale ~500 employees internal: Estimate
- Azure Container Apps: Run NestJS API (and optional worker revision) — Scale-to-zero/min replicas, HTTP ingress, revisions, enough for monolith; far less ops than AKS
- Azure Container Registry: Store images — Private images for ACA pulls
- Azure Database for PostgreSQL – Flexible Server: System of record — Managed backups/PITR, TLS, maintenance; matches Stage A engine
- Azure Blob Storage: Documents / exports — Durable, cheap object storage; private containers; signed URLs (SAS)

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/19-azure-target-architecture.md`](../../docs/19-azure-target-architecture.md)

## Related artifacts

_None listed._
