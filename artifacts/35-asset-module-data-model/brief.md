---
manual: false
generated: 2026-11-13
---

# PeopleOS — Asset Module: Data Model and Flows

**Audience:** General  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Module: IT Assets (register, allocation, requests, tickets, maintenance)

## Key takeaways

- assets.self: Every employee — View own assets, acknowledge, report faults or loss, request assets
- assets.manage: ITADMIN, HRHEAD — Register, categories, allocation, returns, status changes, maintenance, reports
- assets.tickets.manage: ITADMIN, HRHEAD — Handle asset tickets and requests
- id: String PK — cuid
- tenantId: FK → Tenant — 
- code: String — Unique per tenant, e.g. laptop
- name: String — 
- tagPrefix: String — Unique per tenant, e.g. LAP

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/35-asset-module-data-model.md`](../../docs/35-asset-module-data-model.md)

## Related artifacts

_None listed._
