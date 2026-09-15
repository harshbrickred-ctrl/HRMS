# 14 — Security Architecture

HRMS data is highly sensitive (PII, identity documents, potentially compensation fields). Security is a **P0** concern equal to features.

---

## 1. Principles

1. Least privilege  
2. Defense in depth  
3. Secure by default  
4. Complete audit for sensitive actions  
5. Assume breach for document access design  

---

## 2. Authentication

| Control | MVP | Later |
|---------|-----|-------|
| Password hashing | argon2id | Same |
| Tokens | Short-lived access JWT + rotating refresh | Same |
| MFA | TOTP optional flag ready | Enforce for Admin/HR |
| SSO | OIDC interfaces stubbed | Entra ID |
| Session | Refresh revoke list / family | Same |
| Lockout | Progressive backoff | Conditional Access |

---

## 3. Authorization

- **RBAC roles:** Employee, Manager, HR Executive, HR Head, Finance (read-limited), IT Admin, System Admin, CEO (read dashboards)  
- **Resource rules:** self; direct reports (manager chain); HR tenant-wide; admin system  
- **BOLA prevention:** every document/leave/attendance ID checked against tenant + authz  
- **No client-side-only authz**

---

## 4. Data protection

| Data | At rest | In transit | Notes |
|------|---------|------------|-------|
| DB | Disk encryption on pilot/Azure | TLS | Soft delete + retention |
| Files | Encrypted volume / Blob encryption | TLS | Per-object ACL in DB |
| Secrets | Not in git; env/Key Vault | — | Rotate |
| Logs | Redact secrets/PII where possible | — | Correlation IDs OK |

Salary fields: if stored, restrict to Finance/HR Head; prefer **not storing payslips** in MVP if greytHR remains payroll SoR — store only non-payroll docs unless required.

---

## 5. Threat model (selected) & mitigations

| Threat | Mitigation |
|--------|------------|
| Privilege escalation | Central authz service; tests for role matrix |
| Broken object-level auth | Mandatory ownership checks; IDOR test suite |
| Unauthorized employee access | Authn + authz + session revoke on exit |
| Salary / PII leakage | Field-level permissions; minimal storage |
| Document leakage | ACL + short-lived URLs + audit downloads |
| SQL injection | Prisma parameterized queries |
| XSS | React escaping; CSP; sanitize markdown if any |
| CSRF | SPA bearer tokens (less CSRF); SameSite cookies if cookie mode |
| SSRF | No user-supplied outbound URL fetches in MVP |
| File upload attacks | Type/size allowlist; virus scan hook later; store outside web root |
| Credential theft | argon2, MFA, breach detection basics |
| Session hijacking | HTTPS, short JWT, refresh rotation |
| API abuse | Rate limits; auth required |
| Insider threats | Audit logs; dual control for mass export (Phase 2) |

---

## 6. Audit requirements

Log: actor, tenant, action, entity type/id, before/after summary hash, IP, correlation ID, timestamp.  
Immutable append-only table; admin UI read-only.

---

## 7. Retention & recovery

| Item | Policy (Assumption — legal confirm) |
|------|-------------------------------------|
| Employee docs | Retain per HR policy; soft delete |
| Audit logs | ≥ 1 year MVP target |
| Backups | Daily encrypted; monthly restore test |

---

## 8. Security testing gates

- Dependency scanning in CI (OSS)  
- Secret scanning  
- OWASP ZAP baseline on UAT  
- Manual authz checklist before go-live  
