# ADR-003 - Authentication

**Status:** Accepted  
**Date:** 2026-09-14  
**Deciders:** Solution Architect, Security Reviewer  
**Related:** [14-security-architecture](../14-security-architecture.md), ADR-004, ADR-010

---

## Context

Users (employees, managers, HR) need secure login for MVP without blocking on enterprise SSO project timelines. Future state should support Microsoft Entra ID. MFA should be design-ready even if policy enforcement is phased.

## Options

1. **Local username/password + JWT access + rotating refresh** (MFA-ready).  
2. **Entra ID OIDC only from day one.**  
3. **Session cookies only (server sessions).**  
4. **Third-party Auth0/Cognito as primary.**  
5. **API keys for humans** - rejected.

## Decision

**MVP:** Local credentials with **JWT access tokens** and **opaque rotating refresh tokens**; design **MFA (TOTP) hooks** and enrollment storage.  
**Later:** Add **OIDC with Entra ID**; link `entra_oid`; keep provider interface.

## Rationale

- Entra-only would couple MVP to IT IdP readiness (**Assumption:** may lag product).  
- JWT fits SPA + API modular monolith.  
- MFA-ready avoids retrofit of user schema.  
- Locked decision (**Fact**).

## Consequences

**Positive:** Unblocks MVP; SSO additive; refresh rotation mitigates token theft windows.  
**Negative:** Password reset, lockout, and breach response are owned by app until SSO.  
**Follow-ups:** Argon2id/bcrypt; short access TTL; never log tokens; Entra app registration in Stage B+.
