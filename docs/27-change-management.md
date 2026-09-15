# 27 — Change Management, Go-Live & Post-Launch

---

## 1. Adoption strategy

| Audience | Approach |
|----------|----------|
| HR | Hands-on workshops; parallel run with greytHR for non-payroll modules |
| Managers | 30-min inbox training; champion managers in pilot |
| Employees | Short ESS guide; first leave request campaign |
| Leadership | Monthly KPI pack from PeopleOS reports |

**Pilot:** 1–2 departments (~50–80 people) before company-wide.  
**Support:** HR + engineering Slack/Teams channel; severity definitions.

---

## 2. Training collateral

- Employee quick start (2 pages)  
- Manager inbox guide  
- HR admin manual  
- FAQ: what stays in greytHR (payroll/payslips)

---

## 3. Go-live checklist

- [ ] P0 UAT signed by HR Head  
- [ ] Security checklist signed  
- [ ] Backup + restore drill done  
- [ ] Migration reconciliation report accepted  
- [ ] Support rota named  
- [ ] Rollback image tagged  
- [ ] Communications sent (what changes / what doesn’t)  
- [ ] greytHR payroll SoR reconfirmed  

---

## 4. Go / No-Go criteria

**GO** if: critical defects = 0 Sev-1; leave+attendance+auth working; restore drill OK; HR staffing ready.  
**NO-GO** if: authz holes; data loss risk; payroll handoff unclear; HR rejects UAT.

---

## 5. First 30 / 60 / 90 days

| Window | Focus |
|--------|-------|
| 0–30 | Stabilize bugs; adoption coaching; daily standup with HR |
| 31–60 | Expand cohorts; harden reports; address top UX friction |
| 61–90 | Company-wide decision; tech debt burn-down; Azure Phase 2 case; P1 backlog ranking |

**Metric-to-measure:** ESS MAU %, leave in-system %, median approval hours, Sev-1 count, CSAT pulse (simple survey).

---

## 6. Feedback loop

Weekly triage: bugs vs enhancements. Enhancements require trade-off against freeze rules until Week 12 complete.
