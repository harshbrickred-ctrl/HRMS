---
manual: false
generated: 2026-10-05
---

# 33 — Implemented workflow catalog

**Audience:** General  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

This catalog lists every workflow that exists in apps/web, apps/api, and apps/mobile. 08-process-flows names the process the product is meant to have. Where that document and the code disagree, this file follows the code. Specified processes that are missing or only mocked are…

## Key takeaways

- Live: Persisted through the API and Postgres. Survives a reload.
- Session mock: Works in the UI. Stored only in browser state for this session.
- Static: A screen or list with no real state change.
- Specified only: Described in docs/ and not present in apps/.
- EMPLOYEE: Overview, Time, Pay, Workplace, Account, Support — /ess/ — None — ESS self-service, password change, auth
- MANAGER: ESS plus Approvals, team Time, Directory — /ess/, /manager/ — reports.read (never checked) — Inbox approve and reject, plus own ESS
- HREXEC: ESS plus all HR sections, shared with HRHEAD — /ess/, /hr/ — None — Add a directory person, record a fake import. Cannot approve
- HRHEAD: Same nav and buttons as HREXEC — /ess/, /hr/ — rbac.read, audit.read, reports.read (none open a screen) — Same as HREXEC. No seed user

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/33-implemented-workflow-catalog.md`](../../docs/33-implemented-workflow-catalog.md)

## Related artifacts

_None listed._
