# Decision Log

**Purpose:** Record every material decision made by the **user** or the **agent**, with the reason.  
**Product:** PeopleOS (internal HRMS)  
**Rule:** Append new rows; do not rewrite history. Mark superseded decisions as `Superseded` and point to the replacing ID.

| ID | Date | Decided by | Area | Decision | Reason | Status |
|----|------|------------|------|----------|--------|--------|
| D-001 | 2026-09-14 | User | Company context | ~500 employees, IT consultancy, India-only for MVP; incumbent system is greytHR | Grounds product scope, compliance focus, and migration planning | Active |
| D-002 | 2026-09-14 | User | Tech stack | Primary stack = **Node.js / NestJS + React + PostgreSQL** (Option C) | Team preference; strong OSS/Azure migration path without Day-1 cloud spend | Active |
| D-003 | 2026-09-14 | Agent (+ plan lock) | Architecture | **Modular monolith** (not microservices / not AKS) | 4 engineers × 12 weeks; shared transactions for leave+workflow; lower ops cost | Active |
| D-004 | 2026-09-14 | Agent (+ plan lock) | Payroll | **Do not build** Indian statutory payroll engine in MVP; keep greytHR as payroll system of record; PeopleOS exports/coordinates inputs | greytHR strength; 12-week capacity; high compliance risk | Active |
| D-005 | 2026-09-14 | Agent (+ plan lock) | Tenancy | Shared DB / shared schema with mandatory `tenant_id`; single-tenant runtime for internal MVP | SaaS-ready without premature multi-tenant ops | Active |
| D-006 | 2026-09-14 | Agent (+ plan lock) | Infra Stage A | Zero/minimal paid cloud: Docker Compose, OSS, free-tier CI (quota-aware) | Budget constraint; validate product before Azure spend | Active |
| D-007 | 2026-09-14 | Agent (+ plan lock) | Infra Stage B | Azure later: Container Apps + Azure PostgreSQL + Blob + Entra + Key Vault + Monitor | Fits small team; AKS rejected unless scale justifies | Active |
| D-008 | 2026-09-14 | Agent (+ plan lock) | Auth | MVP local email/password + JWT refresh, MFA-ready; Entra OIDC later via provider interface | Avoid Azure lock-in and cost during MVP | Active |
| D-009 | 2026-09-14 | Agent (+ plan lock) | ORM | **Prisma** with PostgreSQL 16 | Velocity + clear migrations for MVP | Active |
| D-010 | 2026-09-14 | Agent (+ plan lock) | CEO recommendation | **APPROVE WITH CONDITIONS** (strict P0, no payroll engine, Azure gated) | Honest investment posture vs blind build | Active |
| D-011 | 2026-09-14 | Agent (+ plan lock) | MVP scope (P0) | Identity/RBAC/Audit, Core HR, Leave, Attendance (+CSV), Workflow v1, Documents, ESS, Manager inbox, Notifications, ops reports, greytHR CSV migration, OpenAPI, Compose | Fits ~145–155 effective person-days after overhead | Active |
| D-012 | 2026-09-14 | Agent (+ plan lock) | Workflow depth | Reminders = P0; escalation/delegation = P1 stretch | Protects 12-week critical path | Active |
| D-013 | 2026-09-14 | Agent (+ plan lock) | Documentation format | Full blueprint under `docs/`; shareable briefs under `artifacts/` (not Cursor Canvas folders) | Canvas cannot mirror per-doc folders; HTML/MD briefs are shareable | Active |
| D-014 | 2026-09-14 | Agent (+ plan lock) | Product name | Working title **PeopleOS** | Internal branding for docs and demos | Active |
| D-015 | 2026-09-16 | Agent | Manager timeline kickoff | Assumed Week 1 start **Mon 21 Sep 2026** → pilot end **Fri 11 Dec 2026** | Needed calendar dates for manager-facing schedule; shift if real kickoff differs | Active |
| D-016 | 2026-09-16 | User | Manager timeline content | Remove “Not in these 12 weeks”, “How to use” note, and markdown footer from shareable timeline | Cleaner artifact for manager sharing | Active |
| D-017 | 2026-09-17 | User | Project tracking | Create living `Decision.md` and `Progress.md` at repo root | Single place for decisions and feature completion status | Active |
| D-018 | 2026-09-17 | Agent | Auth tokens | Stage A returns `accessToken` + `refreshToken` in JSON body (not httpOnly cookies yet) | Simpler local Docker/SPA via Vite proxy; cookie strategy deferred to hardening | Active |
| D-019 | 2026-09-17 | Agent | Repo layout | Monorepo with `apps/api` (NestJS) and `apps/web` (React Vite) + root workspaces | Matches blueprint; shared tooling from repo root | Active |
| D-020 | 2026-09-17 | Agent | Local Postgres port | Map Postgres to host **5440** (not 5432) | Avoid conflict with other local Postgres instances on 5432 | Active |
| D-021 | 2026-09-17 | Agent | RBAC roles | Use SRS catalog codes (`EMPLOYEE`, `MANAGER`, `HR_EXEC`, `HR_HEAD`, `FINANCE_READ`, `IT_ADMIN`, `SECURITY_ADMIN`, `LEADERSHIP_READ`); APIs enforce via permission codes + `PermissionsGuard` | Aligns with FR-RBAC / ADR-004; Progress T-011 shorthand maps to this catalog | Active |
| D-022 | 2026-09-17 | Agent | Authorization depth | Resource policies (manager-of, self, document ACL) deferred until Core HR | RBAC alone is enough for T-011; relationships need employee hierarchy | Active |
| D-023 | 2026-09-17 | Agent | Audit on RBAC | Write minimal `AuditEvent` on role assign/revoke now; full audit explorer remains T-012 | Satisfies US-RBAC-01 “change audited” without blocking on audit UI | Active |
| D-024 | 2026-09-17 | Agent | App IA shell | Five portals (`/ess`, `/manager`, `/hr`, `/admin`, `/exec`) with role gates per UX §2; module pages are placeholders until feature slices; `/` redirects to `/ess` | Lets teams navigate the full P0 surface before deep module work | Superseded → D-028 |
| D-025 | 2026-09-17 | Agent | Password reset | Self-service reset uses **email OTP** (not magic link) then short-lived `resetToken` before set-password | Matches product preference; stronger than OTP-alone password change | Active |
| D-026 | 2026-09-17 | Agent | Reset privacy | Password-reset request always returns a generic success message (no email enumeration) | Enterprise anti-enumeration practice | Active |
| D-027 | 2026-09-17 | Agent | Stage A email | Local SMTP via **Mailpit** (`:1025` / UI `:8025`) for OTP and future notifications | Zero-cost Docker path before company SMTP/ACS | Active |
| D-028 | 2026-09-22 | User (+ Agent) | App IA shell | **Single workspace shell** with role-grouped sidebar sections (Me always; Team/HR/Admin/Leadership when roles apply). No portal switcher. Path prefixes `/ess`, `/manager`, `/hr`, `/admin`, `/exec` remain as namespaces. One smart Home at `/ess`. | Manager (and HR/Admin) are employees first; responsibilities add modules, not separate apps | Active |
| D-029 | 2026-09-22 | Agent | UI theme | Client-side **light / dark / system** preference (default system), stored in `localStorage` (`peopleos-theme`); Design44 semantic CSS tokens + FOUC boot script; profile sync deferred | Stage A velocity; OS-follow default; works on auth pages without API | Active |
| D-030 | 2026-09-23 | Agent | App chrome UX | Three-zone shell (Top / Sidebar / Main); collapsible sidebar (icon rail) persisted in `localStorage`; Lucide icons on nav + header; section dividers between role groups | Clearer IA scanability; denser desktop without losing mobile drawer | Active |
| D-031 | 2026-09-23 | User (+ Agent) | Mobile client | Add **Expo** app at `apps/mobile` (ESS-first). Web **in-app mobile demo** (Design44) opens from sign-in smartphone icon and Me → Mobile — no Expo iframe. Native store shipping still out of scope. | Preview without auth; visual parity with web | Active |

---

## How to add a decision

1. Assign next ID (`D-018`, …).  
2. Set **Decided by** to `User` or `Agent` (or both).  
3. One sentence **Decision**, one sentence **Reason**.  
4. If replacing an older decision: set old row to `Superseded` and note `→ D-0xx`.

---

## Related sources

- [docs/26-adrs/](docs/26-adrs/) — technical Architecture Decision Records  
- [docs/appendices/part-48-final-recommendation.md](docs/appendices/part-48-final-recommendation.md) — locked product/architecture close  
- [docs/01-executive-proposal.md](docs/01-executive-proposal.md) — CEO conditions  
