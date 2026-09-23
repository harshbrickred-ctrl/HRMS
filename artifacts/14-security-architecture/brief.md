---
manual: false
generated: 2026-09-16
---

# 14 — Security Architecture

**Audience:** Engineering / Architecture  
**Artifact type:** Quick brief (1–2 minute skim)

## Thesis

HRMS data is highly sensitive (PII, identity documents, potentially compensation fields). Security is a P0 concern equal to features.

## Key takeaways

- Password hashing: argon2id — Same
- Tokens: Short-lived access JWT + rotating refresh — Same
- MFA: TOTP optional flag ready — Enforce for Admin/HR
- SSO: OIDC interfaces stubbed — Entra ID
- Session: Refresh revoke list / family — Same
- Lockout: Progressive backoff — Conditional Access
- DB: Disk encryption on pilot/Azure — TLS — Soft delete + retention
- Files: Encrypted volume / Blob encryption — TLS — Per-object ACL in DB

## Evidence labels

Use **Fact** / **Assumption** / **Estimate** / **Metric-to-measure** as defined in the source doc. Do not treat this brief as audited ROI or vendor pricing.

## Out of scope / non-claims

This card is a summary only. It does not replace requirements IDs, ADRs, or legal review.

## Deep dive

Full document (source of truth): [`../../docs/14-security-architecture.md`](../../docs/14-security-architecture.md)

## Related artifacts

_None listed._
