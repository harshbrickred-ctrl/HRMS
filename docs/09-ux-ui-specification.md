# 09 — UX / UI Specification

**Product:** PeopleOS MVP  
**Related:** [03-product-vision](03-product-vision.md) · [05-product-requirements-mvp](05-product-requirements-mvp.md) · [08-process-flows](08-process-flows.md) · [07-user-stories](07-user-stories.md)  
**Audience:** Frontend engineer, BA, HR UAT facilitators  
**Constraint:** Responsive web only (no native apps) · NestJS API · React SPA/CSR or hybrid as architecture chooses

---

## Evidence labels

**Fact** | **Assumption** | **Estimate** | **Metric-to-measure**

---

## 1. UX goals & market lessons

### 1.1 Goals

| Goal | Design implication |
|------|--------------------|
| Reduce click-depth | Primary actions from home in ≤2 clicks |
| Clear approvals inbox | First-class Manager surface, not buried under module trees |
| Trust through transparency | Status chips, balance ledger visibility, audit “why rejected” |
| HR as operator | Dense tables, filters, bulk import — not consumer marketing layouts |
| Mobile-ready ESS | Thumb-friendly primary actions; tables degrade to cards on narrow screens |

### 1.2 Market lessons to adopt (**Assumption** from common mid-market HRMS review patterns; validate with users)

| Lesson | Adopt in PeopleOS | Avoid |
|--------|-------------------|-------|
| Deep IA / many modules overwhelm | Role-grouped sections in one shell; hide unauthorized modules | Mega-menus of unused P2 modules; separate portal apps |
| Approvals scattered | Unified **Inbox** | Separate approve UIs per module only |
| Unclear request status | Persistent status timeline | Status only in email |
| Config sprawl before value | Ship opinionated defaults; progressive disclosure for HR Head config | Empty enterprise config consoles on day 1 |
| Mobile afterthought | Responsive ESS/Manager from sprint of feature | “Desktop only” leave apply |
| Error messages opaque | Human + recovery action | Raw SQL/API codes in UI |

**Metric-to-measure:** task success rate & time-on-task for Apply Leave, Approve Leave, Request Correction (baseline in UAT).

---

## 2. App shell architecture

One React app with a **single workspace shell** and **role-grouped navigation** (**Fact**: RBAC in MVP; **D-028**).

| Nav section | Route prefix | Roles that unlock it | Purpose |
|-------------|--------------|----------------------|---------|
| **Me** | `/ess` | Always (any authenticated user) | Self-service daily HR |
| **Team** | `/manager` | MANAGER | Inbox + team visibility |
| **HR** | `/hr` | HR_EXEC, HR_HEAD | Operate people processes |
| **Admin** | `/admin` | IT_ADMIN, SECURITY_ADMIN | Identity, roles, system config, audit |
| **Leadership** | `/exec` | LEADERSHIP_READ | Operational read dashboards |

**Fact:** A manager is an employee first. Extra responsibilities (Manager, HR, Admin, Leadership) **add sidebar sections** in the same shell — there is **no portal switcher** and no separate “manager app.”

**Assumption:** Users with multiple roles see multiple sections at once; Home at `/ess` surfaces Me widgets plus role teasers (team inbox, HR/Admin jumps).

### 2.1 Global chrome

Three-zone layout (**D-030**): Top bar · collapsible Sidebar · Main application zone.

```text
┌──────────────────────────────────────────────────────────────┐
│ [≡] Brand     Search*  Alerts  Theme  User  Sign out         │  ← Top bar
├────────────┬─────────────────────────────────────────────────┤
│ Me         │  Page title                                     │
│ 🏠 Home    │─────────────────────────────────────────────────│
│ …          │  Elevated content pad (surface + shadow)        │
│ ─────────  │                                                 │  ← Main zone
│ Team       │                                                 │
│ …          │                                                 │
└────────────┴─────────────────────────────────────────────────┘
     ↑ Sidebar: icons + labels; dividers between role sections;
       desktop collapse → icon rail (localStorage)
* GlobalSearch: employees for HR/Manager; limited for Me self-service (**Assumption**)
```

Nav items use Lucide icons. Mobile: off-canvas drawer (collapse preference ignored).

---

## 3. Navigation IA

Sidebar is composed of **grouped sections**. Only sections the user is authorized for are shown.

### 3.1 Me (always)

| Nav item | Children / notes |
|----------|------------------|
| Home | Widgets + quick actions; role teasers when Manager/HR/Admin/Leadership |
| Leave | Apply, My requests, Balances, Calendar |
| Attendance | Mark, Month view, Corrections |
| People | Company directory (public work details) |
| Documents | My documents, Policies (company library) |
| Profile | Personal, Job (read), Contacts |
| Notifications | Full list |

### 3.2 Team (MANAGER)

| Nav item | Notes |
|----------|-------|
| Overview | Team signals summary |
| **Inbox** | Approvals; primary Team entry when pending > 0 |
| Team Leave | Calendar / list |
| Team Attendance | Month + exceptions |
| Team Directory | Direct reports |

### 3.3 HR (HR_EXEC / HR_HEAD)

| Nav item | Notes |
|----------|-------|
| Overview | Queues: incomplete profiles, import errors, escalations |
| Employees | Search, create, bulk import |
| Organization | Depts, designations, locations |
| Leave Admin | Types, policies, balances, holidays |
| Attendance Admin | Import, locks, shifts |
| Documents | Categories, company docs, compliance |
| Workflows | Definitions, stuck instances |
| Reports | P0 operational set |
| Migration | CSV tools (permissioned) |

### 3.4 Admin (IT_ADMIN / SECURITY_ADMIN)

| Nav item | Notes |
|----------|-------|
| Overview | Identity / system health entry |
| Users & Roles | |
| Audit log | |
| Notifications / Email health | |
| System settings | SMTP, retention labels, feature flags |
| Jobs | Reminder/escalation job status |

### 3.5 Leadership (LEADERSHIP_READ)

| Nav item | Notes |
|----------|-------|
| Overview | Headcount, joiners/exits, exception rates |
| Reports | Same report runner, org-wide defaults |
| Deep links | Into HR views **read-only** where permitted |

---

## 4. Key screens (wireframe-level)

### 4.1 Me Home (`/ess`)

**Layout**
1. Greeting + date  
2. **Quick actions** row: Apply Leave · Mark Attendance · Upload Doc · Notifications · Approvals (if Manager)  
3. Cards: Leave balances (compact) · Pending requests · Unread notifications  
4. If Manager: **Your team** teaser (inbox count, on leave today) linking to Team section  
5. If HR/Admin/Leadership: **Your responsibilities** jump links  

**Rules**
- No more than one primary CTA visually dominant (Apply Leave or Mark Attendance by time-of-day heuristic — **Assumption**).  
- Empty states: illustration-light + link to first action (avoid blank tables).

### 4.2 Manager Inbox (critical)

| Column | Content |
|--------|---------|
| Type | Leave / Attendance correction / (future) |
| Requester | Name + code |
| Summary | Dates / change summary |
| Age | Relative time; escalate badge |
| Actions | Approve · Reject · Open |

**UX requirements**
- Approve inline with optional comment; Reject **requires** comment (modal).  
- Keyboard: `j/k` optional later; MVP: tab-focusable actions.  
- Bulk approve **out of MVP** (risk) — **Fact** non-goal.  
- Deep link opens drawer/page with full context + timeline.

### 4.3 Apply Leave

Single-page form:
- Leave type (select)
- Start / End (date) + half-day toggles
- Computed working days preview (**Assumption**: client+server agree)
- Balance after request preview
- Reason (textarea)
- Submit → success toast + link to My requests

Errors inline next to fields; conflict dates listed.

### 4.4 Attendance month view

- Calendar grid with status color tokens (Present, Absent, Holiday, Weekend, Pending correction).  
- Legend always visible.  
- Click day → detail drawer (punches/status + Request correction).  
- Manager view: employee selector / team grid toggle.

### 4.5 HR Employee list

Enterprise table pattern (§5). Primary CTA: **Add employee**. Secondary: **Import CSV**.

### 4.6 Documents library

- Filters: category, mine vs company, date.  
- Upload modal with drag-drop + type hints.  
- Row actions: Download, Soft delete (HR).  

### 4.7 Executive overview

Sparse: 4–6 KPI tiles + 2 charts max (joiners/exits trend, attendance exception rate). Link “View report” — **not** a BI suite.

---

## 5. Tables, forms, filters

### 5.1 Tables

| Pattern | Spec |
|---------|------|
| Density | Comfortable default; compact toggle for HR (**Should**) |
| Pagination | Server-side; default 20; page size 20/50 |
| Sort | One primary column; multi-sort later |
| Filters | Left drawer or top filter bar; Apply/Clear explicit |
| Selection | Row select for bulk **only where MVP supports** (avoid fake checkboxes) |
| Empty | Explain + CTA |
| Loading | Skeleton rows |
| Error | Retry banner |

### 5.2 Forms

| Pattern | Spec |
|---------|------|
| Labels | Visible labels (not placeholder-only) |
| Required | Asterisk + text |
| Validation | On blur + on submit |
| Destructive | Confirm modal with consequence text |
| Long forms | Sections with sticky footer actions Save/Cancel |
| Dates | IST display; store UTC or date-only as schema dictates |

### 5.3 Status chips

Standardize: `Draft` `Pending` `Approved` `Rejected` `Withdrawn` `Escalated` `Locked` — same tokens across Leave/Attendance/WF.

---

## 6. Approvals UX (Team section)

| Principle | Implementation |
|-----------|----------------|
| One inbox | `/manager/inbox` aggregates tasks |
| Context at point of decision | Side panel: request detail + policy hints + history |
| No mystery meat | Buttons labeled Approve / Reject — not icons alone |
| Post-decision | Remove from inbox; toast; undo **not** required if audit solid |
| Escalation visibility | Badge + “Escalated to you” reason |

HR sees **Escalations** queue under HR Home for unowned/stuck items.

---

## 7. Notifications UX

- Header bell with unread count.  
- Dropdown last 10 + “View all”.  
- Items: icon by type, title, time, unread dot.  
- Click → mark read + navigate deep link.  
- Email content mirrors title + 1–2 lines + CTA button (not full PII dumps).

---

## 8. Accessibility (NFR-USA-001)

| Area | Requirement |
|------|-------------|
| Keyboard | All primary flows operable without mouse |
| Focus | Visible focus ring; logical order |
| Contrast | WCAG 2.2 AA target for text/UI |
| Forms | `label` associated; errors in `aria-live` polite |
| Tables | Column headers; sort buttons named |
| Modals | Focus trap; Esc closes; return focus |
| Status | Not color-only — icon/text too |

UAT should include keyboard pass on Login, Apply Leave, Inbox.

---

## 9. Responsive / mobile web

| Breakpoint (**Estimate**) | Behavior |
|---------------------------|----------|
| ≥1200px | Side nav expanded |
| 768–1199 | Collapsible side nav |
| <768 | Bottom or hamburger nav; tables → stacked cards for ESS lists; Inbox as card list; sticky primary CTA |

**Touch:** min 40px targets for primary buttons.  
**Native app:** P2 — do not imply install banners.

---

## 10. Design tokens (guidance — not a new brand system)

Preserve internal brand (Design44); map to **semantic CSS variables** used by the SPA:

| Token | Guidance |
|-------|----------|
| `--bg` / `--surface` / `--surface-elevated` | Workspace canvas and panels |
| `--ink` / `--muted` / `--line` | Text and dividers |
| `--accent` (key-lime) | Primary actions; same brand hue in light and dark |
| `--danger` / `--danger-bg` | Reject / destructive |
| Status chip tokens | `--chip-*` — meaning preserved across themes |
| Typography | Syne (display) + DM Sans (body) |
| Radius / shadow | Subtle; enterprise density over glassmorphism |

**Theme (D-029):** Support **light**, **dark**, and **system** (default). Preference is client-side (`localStorage`); resolved theme sets `html[data-theme]` and `color-scheme`. Contrast target remains WCAG 2.2 AA for text/UI.

**Exception to marketing frontend rules:** This is an operational product — prioritize clarity and tables over hero compositions.

---

## 11. Content & microcopy

| Situation | Tone |
|-----------|------|
| Validation | Specific: “End date must be on or after start date.” |
| Permission | “You don’t have access to this employee. If this is wrong, contact HR.” |
| SMTP down | “We couldn’t send email. Your request was still saved; tell your manager in chat if urgent.” |
| Migration errors | Row number + field + fix hint |

No playful copy on reject/exit flows.

---

## 12. Surface visibility matrix (UX)

| Surface | Emp | Mgr | HR | Admin | Exec |
|---------|-----|-----|----|-------|------|
| Me Home (`/ess`) | ● | ● | ● | ● | ● |
| Team Inbox | — | ● | ○ view stuck | — | — |
| HR Employees | — | team read | ● | — | read reports |
| Audit | — | — | limited | ● | — |
| Migration | — | — | ● Head | ● | — |

● full · ○ limited · — hidden (section not shown in nav)

---

## 13. UX acceptance checklist (MVP)

- [ ] Multi-role user sees **grouped sections** (e.g. Me + Team) in one shell — no portal switcher
- [ ] Manager with pending tasks sees Inbox badge/teaser on Home or reaches Inbox in ≤2 clicks
- [ ] Apply Leave completable in ≤2 clicks from Me Home
- [ ] Attendance correction reachable from month day cell
- [ ] Document download denial shows clear message (no blank error)
- [ ] 360px: mark attendance + apply leave usable
- [ ] Keyboard path for Inbox approve/reject
- [ ] No navigation entries to P2 modules

**Metric-to-measure:** SUS or CES after pilot cohort week 2.

---

## 14. Deliverables before coding UI at scale

| Deliverable | Owner | When |
|-------------|-------|------|
| Low-fi wires: ESS Home, Inbox, Apply Leave, HR Employee list | FE + BA | Weeks 1–2 |
| Token sheet / basic theme | FE | Week 3 |
| Component inventory (Button, Table, Form, Chip, Modal, Toast) | FE | Weeks 3–4 |
| UAT script mapped to stories | QA + HR | Week 10 |

---

*UX changes that increase click-depth or split Inbox require Product approval — they violate principles P2/P3 in [03-product-vision](03-product-vision.md).*
