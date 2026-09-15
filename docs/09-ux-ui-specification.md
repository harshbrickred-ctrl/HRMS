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
| Deep IA / many modules overwhelm | Role-based portals with slim nav | Mega-menus of unused P2 modules |
| Approvals scattered | Unified **Inbox** | Separate approve UIs per module only |
| Unclear request status | Persistent status timeline | Status only in email |
| Config sprawl before value | Ship opinionated defaults; progressive disclosure for HR Head config | Empty enterprise config consoles on day 1 |
| Mobile afterthought | Responsive ESS/Manager from sprint of feature | “Desktop only” leave apply |
| Error messages opaque | Human + recovery action | Raw SQL/API codes in UI |

**Metric-to-measure:** task success rate & time-on-task for Apply Leave, Approve Leave, Request Correction (baseline in UAT).

---

## 2. Portal architecture

Five portals share one React app with **role-based shell** and route guards (**Fact**: RBAC in MVP).

| Portal | Route prefix | Primary roles | Purpose |
|--------|--------------|---------------|---------|
| **Employee (ESS)** | `/ess` | EMPLOYEE (+ all humans) | Self-service daily HR |
| **Manager** | `/manager` | MANAGER | Inbox + team visibility |
| **HR** | `/hr` | HR_EXEC, HR_HEAD | Operate people processes |
| **Admin** | `/admin` | IT_ADMIN, SECURITY_ADMIN | Identity, roles, system config, audit |
| **CEO / Leadership** | `/exec` | CEO, LEADERSHIP_READ | Operational read dashboards |

**Assumption:** Users with multiple roles switch via portal switcher in header (not separate logins).

### 2.1 Global chrome

```text
┌──────────────────────────────────────────────────────────┐
│ Brand  PortalSwitcher   GlobalSearch*   Alerts   Avatar  │
├────────────┬─────────────────────────────────────────────┤
│ Side nav   │  Page header (title, breadcrumbs, actions)  │
│ (portal)   │─────────────────────────────────────────────│
│            │  Content                                    │
│            │                                             │
└────────────┴─────────────────────────────────────────────┘
* GlobalSearch: employees for HR/Manager; limited for ESS (**Assumption**)
```

---

## 3. Navigation IA

### 3.1 ESS

| Nav item | Children / notes |
|----------|------------------|
| Home | Widgets + quick actions |
| Leave | Apply, My requests, Balances, Calendar |
| Attendance | Mark, Month view, Corrections |
| Documents | My documents, Policies (company library) |
| Profile | Personal, Job (read), Contacts |
| Notifications | Full list |

### 3.2 Manager

| Nav item | Notes |
|----------|-------|
| Home | Inbox count, team leave today, exceptions |
| **Inbox** | Default landing for managers with pending > 0 |
| Team Leave | Calendar / list |
| Team Attendance | Month + exceptions |
| Team Directory | Direct reports |

### 3.3 HR

| Nav item | Notes |
|----------|-------|
| Home | Queues: incomplete profiles, import errors, escalations |
| Employees | Search, create, bulk import |
| Organization | Depts, designations, locations |
| Leave Admin | Types, policies, balances, holidays |
| Attendance Admin | Import, locks, shifts |
| Documents | Categories, company docs, compliance |
| Workflows | Definitions, stuck instances |
| Reports | P0 operational set |
| Migration | CSV tools (permissioned) |

### 3.4 Admin

| Nav item | Notes |
|----------|-------|
| Users & Roles | |
| Audit log | |
| Notifications / Email health | |
| System settings | SMTP, retention labels, feature flags |
| Jobs | Reminder/escalation job status |

### 3.5 Executive

| Nav item | Notes |
|----------|-------|
| Overview | Headcount, joiners/exits, exception rates |
| Reports | Same report runner, org-wide defaults |
| Deep links | Into HR views **read-only** where permitted |

---

## 4. Key screens (wireframe-level)

### 4.1 ESS Home

**Layout**
1. Greeting + date  
2. **Quick actions** row: Apply Leave · Mark Attendance · Upload Doc · View Inbox status  
3. Cards: Leave balances (compact) · Pending requests · Unread notifications  
4. Optional: “On leave this week in your team” teaser if manager dual-role  

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

## 6. Approvals UX (cross-portal)

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

Preserve internal brand if provided; otherwise define CSS variables early:

| Token | Guidance |
|-------|----------|
| `--color-bg` | Neutral light workspace (avoid purple-gradient SaaS cliché) |
| `--color-primary` | Company brand or restrained blue/teal for IT consultancy |
| `--color-danger` | Reject / destructive |
| `--color-success` | Approved |
| `--color-warning` | Escalated / pending aging |
| Typography | Clear UI sans already licensed by company; avoid random novelty fonts in app chrome |
| Radius / shadow | Subtle; enterprise density over glassmorphism |

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

## 12. Portal permission vs visibility matrix (UX)

| Surface | Emp | Mgr | HR | Admin | Exec |
|---------|-----|-----|----|-------|------|
| ESS Home | ● | ● | ● | ● | ● |
| Manager Inbox | — | ● | ○ view stuck | — | — |
| HR Employees | — | team read | ● | — | read reports |
| Audit | — | — | limited | ● | — |
| Migration | — | — | ● Head | ● | — |

● full · ○ limited · — hidden

---

## 13. UX acceptance checklist (MVP)

- [ ] Manager with pending tasks lands on Inbox or sees persistent Inbox badge  
- [ ] Apply Leave completable in ≤2 clicks from ESS Home  
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
