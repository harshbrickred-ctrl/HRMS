# 08 — Process Flows

**Product:** PeopleOS MVP  
**Related:** [05-product-requirements-mvp](05-product-requirements-mvp.md) · [06-srs-functional](06-srs-functional.md) · [09-ux-ui-specification](09-ux-ui-specification.md) · [33-implemented-workflow-catalog](33-implemented-workflow-catalog.md) (what the app does today; this file remains the spec)  
**Notation:** Mermaid flowcharts / sequence diagrams  
**Labels:** Happy path = solid; exceptions described in notes (**Assumption** where policy TBD)

---

## 1. Leave request & approval

**Maps to:** FR-LEAVE-003, FR-LEAVE-004, FR-WF-002, FR-WF-003, FR-NOTIF-*

```mermaid
flowchart TD
  A[Employee opens Apply Leave] --> B{Valid dates & type?}
  B -->|No| B1[Show validation errors]
  B1 --> A
  B -->|Yes| C{Balance sufficient?}
  C -->|No| C1[Block or HR override path]
  C -->|Yes| D{Overlap with approved/pending?}
  D -->|Yes| D1[Reject submit with conflict details]
  D -->|No| E[Create LeaveRequest Pending]
  E --> F[Start WorkflowInstance]
  F --> G[Create Task for Approver]
  G --> H[In-app + Email notify Approver]
  H --> I{Approver action}
  I -->|Approve| J[Complete step / instance]
  J --> K[Post ledger consumption]
  K --> L[Status Approved]
  L --> M[Notify Employee]
  I -->|Reject| N[Status Rejected + comment]
  N --> M
  I -->|No action until reminder| O[Send reminder]
  O --> P{Escalation threshold?}
  P -->|No| I
  P -->|Yes| Q[Reassign to backup/HR]
  Q --> H
  I -->|Employee withdraws while Pending| R[Cancel instance]
  R --> S[Status Withdrawn]
  S --> T[Notify Approver task cancelled]
```

**Business notes**
- Approver = reporting manager by default (**Assumption**).
- Half-day and holiday interaction follow policy flags (**Assumption** — freeze in Week 2).
- Concurrent withdraw vs approve: status check / version guard (**Estimate**).

---

## 2. Attendance correction

**Maps to:** FR-ATT-004, FR-WF-*, FR-AUD-001

```mermaid
sequenceDiagram
  actor Emp as Employee
  participant ESS as ESS UI
  participant API as Attendance API
  participant WF as Workflow
  participant Mgr as Manager
  participant Aud as Audit

  Emp->>ESS: Open day / request correction
  ESS->>API: Create CorrectionRequest (from, to, reason)
  API->>API: Validate period not locked
  API->>WF: Start ATT_CORRECTION instance
  WF->>Mgr: Task + notification
  Mgr->>WF: Approve / Reject (+ comment)
  alt Approved
    WF->>API: Apply correction to AttendanceRecord
    API->>Aud: before/after event
    API->>Emp: Notify approved
  else Rejected
    WF->>API: Mark correction Rejected
    API->>Emp: Notify rejected
  end
```

```mermaid
flowchart TD
  A[Select date needing fix] --> B{Period locked?}
  B -->|Yes| B1[Block - contact HR]
  B -->|No| C[Enter proposed status/punches + reason]
  C --> D{Evidence file optional}
  D --> E[Submit correction]
  E --> F[Workflow to Manager/HR]
  F --> G{Decision}
  G -->|Approve| H[Update attendance]
  H --> I[Audit + notify]
  G -->|Reject| J[Keep original + notify]
  G -->|Escalate| K[HR queue]
  K --> G
```

**Business notes**
- HR break-glass direct correct allowed with mandatory reason (**Assumption**).
- Import after correction: last-write policy must be documented to avoid silent clobber (**Assumption**).

---

## 3. Document access (upload / download)

**Maps to:** FR-DOC-001, FR-DOC-002, FR-AUD-001

```mermaid
flowchart TD
  A[User selects Upload or Download] --> B{Action type}
  B -->|Upload| C{MIME & size allowlisted?}
  C -->|No| C1[Reject with guidance]
  C -->|Yes| D{Category ACL allows upload?}
  D -->|No| D1[403]
  D -->|Yes| E[Store blob + metadata]
  E --> F[Audit upload]
  B -->|Download| G{Category ACL allows read?}
  G -->|No| G1[403 + audit deny]
  G -->|Yes| H[Stream / signed URL short TTL]
  H --> I[Audit download]
```

```mermaid
sequenceDiagram
  actor U as User
  participant UI as Documents UI
  participant API as Doc API
  participant ST as Storage
  participant AUD as Audit

  U->>UI: Request download
  UI->>API: GET document
  API->>API: Authorize by role + category + ownership
  alt Denied
    API->>AUD: Access denied
    API-->>UI: 403
  else Allowed
    API->>ST: Fetch object
    ST-->>API: Bytes / signed URL
    API->>AUD: Access granted
    API-->>UI: File
  end
```

**Business notes**
- Stage A may lack full AV scanning; allowlist + size are compensating controls (**Assumption**/risk accepted until Stage B).

---

## 4. Employee join (hire)

**Maps to:** FR-CORE-002, FR-IDN-004, FR-DOC-001 (optional pack), FR-NOTIF-*

```mermaid
flowchart TD
  A[HR creates employee] --> B{Validate mandatory fields}
  B -->|Fail| B1[Show field errors]
  B -->|Pass| C[Persist Employee Active]
  C --> D[Create User linked to employee]
  D --> E[Assign EMPLOYEE role]
  E --> F[Send invite / reset email]
  F --> G[Optional: request mandatory docs]
  G --> H[Employee completes profile contacts]
  H --> I[Ready for leave/attendance eligibility]
  I --> J[Audit hire event]
```

**Out of MVP / P1:** full preboarding portal, asset checklist automation, ATS offer acceptance sync.

**Light onboarding note (P0):** HR may attach joining letter via Documents; structured checklist is P1.

---

## 5. Offboarding (light)

**Maps to:** FR-CORE-003, FR-DOC-*, identity disable, audit

```mermaid
flowchart TD
  A[HR initiates Exit] --> B[Capture LWD / reason codes]
  B --> C[Set employment status Exit/Notice per policy]
  C --> D[Disable login on effective exit date]
  D --> E[Cancel pending leave? policy decision]
  E --> F[Flag open attendance corrections]
  F --> G[Document checklist notes - light]
  G --> H[Notify Manager + IT for access revoke outside app]
  H --> I[Retain employee record - no hard delete]
  I --> J[Audit exit]
```

**Assumptions**
- Full IT asset recovery tracked in P1 Assets or external ITSM.
- Alumni portal deferred (P2).
- Pending leave: auto-reject vs allow consume through LWD — freeze in policy workshop.

---

## 6. Approval escalation

**Maps to:** FR-WF-004 (P1 stretch), FR-NOTIF-002; reminders = FR-WF-003 (P0)

```mermaid
stateDiagram-v2
  [*] --> TaskOpen
  TaskOpen --> Reminded: reminder_at reached
  Reminded --> TaskOpen: still pending
  Reminded --> Escalated: escalate_at reached
  TaskOpen --> Escalated: escalate_at reached without reminder config
  Escalated --> TaskOpen: reassigned to backup/HR
  TaskOpen --> Completed: approve
  TaskOpen --> Completed: reject
  Completed --> [*]
```

```mermaid
flowchart TD
  A[Scheduler job runs] --> B[Find open tasks past reminder_at]
  B --> C[Send reminder notification/email]
  C --> D[Find tasks past escalate_at]
  D --> E{Backup approver configured?}
  E -->|Yes| F[Reassign task to backup]
  E -->|No| G[Reassign to HR queue]
  F --> H[Notify new assignee + original]
  G --> H
  H --> I[Write audit escalation event]
```

**Configuration knobs (**Assumption** defaults)**
- Reminder: 24h after assignment  
- Escalation: 48–72h after assignment  
- Per-request-type overrides allowed for HR Head

---

## 7. Cross-flow: period lock (payroll coordination)

Not a full payroll engine — coordination only (**Fact**).

```mermaid
flowchart LR
  A[HR/Finance opens period] --> B[Attendance + Leave settle]
  B --> C[Set Period Locked]
  C --> D[Block employee self mark/correct]
  D --> E[Export attendance/leave inputs]
  E --> F[Import into greytHR payroll]
  F --> G[Exceptions returned to HR queue]
```

---

## 8. Flow-to-requirement traceability

| Flow | Primary FRs | Stories | UX screens ([09](09-ux-ui-specification.md)) |
|------|-------------|---------|-----------------------------------------------|
| Leave | FR-LEAVE-003/004, FR-WF-*, FR-NOTIF-* | US-LEAVE-03/04, US-WF-* | ESS Apply Leave; Manager Inbox |
| Attendance correction | FR-ATT-004, FR-WF-* | US-ATT-04 | ESS Correction; Inbox |
| Document access | FR-DOC-001/002 | US-DOC-01/02 | Documents library |
| Employee join | FR-CORE-002, FR-IDN-004 | US-CORE-02/03 | HR Employee Create |
| Offboarding light | FR-CORE-003 | US-CORE-04 | HR Exit dialog |
| Reminders | FR-WF-003 | US-WF-03 | Inbox + email |
| Escalation (P1) | FR-WF-004 | US-WF-04 | Inbox + email |

---

*Validate timers and leave edge policies in Weeks 1–2 workshops; update this file when Assumptions convert to Facts.*
