---
manual: false
generated: 2026-09-13
---

# 06 — Software Requirements Specification (Functional & Non-Functional)

**Audience:** Product / HR / BA  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

Traceability columns: Story · Test · Release

## Key takeaways

- Purpose: Specify testable functional and non-functional requirements for P0 MVP
- Scope: Identity/RBAC, Core HR, Leave, Attendance, Workflow, Documents, ESS/Manager, Notifications, Audit, Reports, Migration support, Platform NFRs
- Out of scope: P2 modules listed in 05
- Users: Roles in 04
- References: OpenAPI /api/v1; Docker Compose; CI pipeline
- Title: Authenticate with email and password
- Requirement: System shall authenticate registered users with email + password and issue a session/access token.
- Description: Primary login for ESS/HR/Admin portals. India IST timestamps on audit.

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/06-srs-functional.md`](../../docs/06-srs-functional.md)

## Related artifacts

_None listed._
