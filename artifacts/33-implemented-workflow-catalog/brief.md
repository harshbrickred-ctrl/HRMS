---
manual: false
generated: 2026-11-13
---

# 33 — Implemented workflow catalog

**Audience:** Product / HR / BA  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

This catalog lists workflows that exist in apps/web, apps/api, and apps/mobile. Where 08-process-flows and the code disagree, this file follows the code. Specified processes that are missing or only mocked are listed at the end.

## Key takeaways

- Live: Persisted through the API and Postgres. Survives a reload.
- Session mock: Works in the UI. Stored only in browser state for this session.
- Static: A screen or list with no real state change.
- Specified only: Described in docs/ and not present in apps/.
- EMPLOYEE: Me only (/ess/) — Leave apply/withdraw; attendance punch + correction; documents; helpdesk create; payslip download; My Assets request / fault / loss / acknowledge; change password
- MANAGER: Me + Approvals + Team Time + Directory — Approve/reject leave and attendance corrections (Inbox, Team Leave, Team Attendance); own ESS
- HREXEC: Me + People + Time + Programs — Employees, org, leave balances, attendance admin (shifts, holidays, devices, override, lock, register), Document Center + payslip upload, Workflows queues
- HRHEAD: Same as HREXEC + Assets — All HREXEC actions plus full IT asset lifecycle

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/33-implemented-workflow-catalog.md`](../../docs/33-implemented-workflow-catalog.md)

## Related artifacts

_None listed._
