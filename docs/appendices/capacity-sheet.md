# Appendix — Capacity Sheet (4 × 12 Weeks)

**Product:** PeopleOS (internal HRMS)  
**Audience:** Lead / Architect, CEO (capacity realism), Engineering  
**Evidence labels:** **Fact** | **Assumption** | **Estimate** | **Metric-to-measure**  
**Related:** [24-project-plan-12-weeks.md](../24-project-plan-12-weeks.md), [25-sprint-plan.md](../25-sprint-plan.md)

---

## 1. Gross capacity (**Fact** math)

| Input | Value | Label |
|-------|-------|-------|
| Engineers | 4 | **Fact** (team size) |
| Calendar weeks | 12 | **Fact** (hard window) |
| Working days / week | 5 | **Assumption** (no weekend coding as baseline) |
| Gross person-days | 4 × 12 × 5 = **240** | **Fact** (arithmetic) |

**Gross hours (optional view):** 240 × 8 = **1,920 hours** — **Assumption** of 8-hour day; actual India IT day length varies; use person-days as primary unit.

---

## 2. Non-coding / overhead deduction (**Estimate**)

Industry small-team delivery typically loses 30–45% of calendar capacity to meetings, reviews, clarification, and interrupts. This program uses **35–40%**.

| Category | Share of gross | Person-days (mid) | Notes |
|----------|----------------|-------------------|-------|
| Ceremonies (standup, planning, review, retro) | 8–10% | ~22 | 2-week sprints |
| Clarification / HR workshops / stakeholder | 6–8% | ~17 | Heavier Weeks 1–2, 11–12 |
| Code review | 5–7% | ~14 | Mandatory PR review |
| Documentation / ADRs | 4–6% | ~12 | Blueprint + living docs |
| Environment / CI / Docker friction | 3–5% | ~10 | Free-tier and local ops |
| Context switching / interrupts | 4–6% | ~12 | Support, ad-hoc asks |
| **Subtotal overhead** | **~35–40%** | **~84–96** | **Estimate** |

| Scenario | Overhead % | Effective coding+test days |
|----------|------------|----------------------------|
| Optimistic | 35% | 240 × 0.65 = **156** |
| Baseline (plan) | 37.5% | 240 × 0.625 = **150** |
| Conservative | 40% | 240 × 0.60 = **144** |

**Planning band used in docs:** **145–155 effective person-days** — **Estimate**.

---

## 3. Contingency (**Estimate**)

| Item | Value |
|------|-------|
| Contingency rate | **15%** of effective capacity |
| On 150 mid effective | 0.15 × 150 = **22.5** ≈ **23 person-days** |
| **Commit-able feature capacity** | 150 − 23 = **~127 person-days** |
| Band | **~123–132 person-days** committed P0 work |

Contingency is **not** a feature backlog. It absorbs migration surprises, UAT defects, security findings, and sick leave.

---

## 4. Capacity by role (**Estimate** allocation)

| Role | Gross days | Effective (~37.5% off) | Commit-able after 15% cont. | Primary ownership |
|------|------------|------------------------|-----------------------------|-------------------|
| Lead / Architect | 60 | ~37.5 | ~32 | Architecture, RBAC, reviews, risk, go-live |
| Backend | 60 | ~37.5 | ~32 | APIs, schema, leave/attendance/workflows |
| Frontend | 60 | ~37.5 | ~32 | ESS, Manager, HR Admin UI |
| Full-stack / QA | 60 | ~37.5 | ~32 | CI, E2E, security tests, migration tooling, deploy |

Cross-train: Backend ↔ Full-stack on migrations; Frontend ↔ Full-stack on E2E selectors; Lead pairs on security.

---

## 5. Capacity by phase (**Estimate**)

| Weeks | Phase | Share of commit-able (~127) | Person-days |
|-------|-------|-----------------------------|-------------|
| 1–2 | Discovery / PRD / UX / ADRs / schema / greytHR | 12% | ~15 |
| 3–4 | Foundation (auth, RBAC, audit, Docker, CI) | 16% | ~20 |
| 5–7 | Core HR + Leave + Workflow | 28% | ~36 |
| 8 | Attendance | 10% | ~13 |
| 9–10 | ESS / Manager / Documents / Notifications / Reports | 18% | ~23 |
| 11 | Security / UAT / migration dry-run | 10% | ~13 |
| 12 | Pilot go-live / training | 6% | ~8 |
| **Total** | | **100%** | **~128** |

Week 1–2 includes substantial non-coding product work; effective coding days are lower than calendar suggests — already reflected in overhead.

---

## 6. Module effort budget (P0 only) (**Estimate**)

Aligned to committed scope (~127 person-days). Complexity: S≈2–3d, M≈5–8d, L≈10–15d (team-days, not calendar).

| Module / workstream | Complexity | Est. person-days | Sprint focus |
|---------------------|------------|------------------|--------------|
| Discovery, PRD freeze, UX, ADRs, schema v1 | L | 14–16 | Sprint 0 / early 1 |
| greytHR export discovery + mapping draft | M | 5–7 | Sprint 0–1 |
| Auth / identity / sessions | M | 6–8 | Sprint 1 |
| RBAC + permissions matrix | M | 5–7 | Sprint 1 |
| Audit logging | S–M | 3–5 | Sprint 1 |
| Docker Compose + CI baseline | M | 5–7 | Sprint 1 |
| Employee master / org structure | L | 10–12 | Sprint 2 |
| Leave policies + balances + requests | L | 12–14 | Sprint 2–3 |
| Approval workflow engine (simple) | M–L | 8–10 | Sprint 2–3 |
| Attendance (manual / import MVP) | L | 10–13 | Sprint 3–4 |
| ESS (self-service) | M | 7–9 | Sprint 4–5 |
| Manager portal | M | 6–8 | Sprint 4–5 |
| Documents (upload/store/metadata) | M | 5–7 | Sprint 5 |
| In-app notifications | S–M | 3–5 | Sprint 5 |
| Reports (P0 set) | M | 5–7 | Sprint 5 |
| Security hardening + UAT support | M | 6–8 | Sprint 5–6 |
| Migration dry-run + pilot cutover | M–L | 8–10 | Sprint 6 |
| Training materials / hypercare prep | S | 3–4 | Sprint 6 |
| **Sum (mid)** | | **~125–140** | Must fit via scope discipline |

If sum exceeds commit-able band, **cut P0 features** — do not silently burn contingency.

---

## 7. What is explicitly out of capacity

| Item | Why excluded |
|------|--------------|
| Statutory payroll engine | Locked decision; greytHR payroll retained |
| Full recruitment ATS | Not P0 |
| Performance / OKR suite | Not P0 |
| Multi-tenant runtime SaaS | Schema readiness only |
| Azure production HA/DR | Stage B after gates |
| Invented ROI payback models | Forbidden in this pack |

---

## 8. Burn tracking template (**Metric-to-measure**)

Track weekly (Friday):

| Metric | Formula | Target band |
|--------|---------|-------------|
| Planned remaining P0 days | From backlog | Decreasing |
| Actual remaining | Re-estimate | Within ±15% of plan |
| Contingency remaining | Start 23 − consumed | ≥5 days entering Week 11 |
| Defect open P0/P1 | Count | Trend down Weeks 11–12 |
| Scope change requests | Count + days | Must be deferred or swap |

---

## 9. Sensitivity (**Estimate**)

| Shock | Effect | Response |
|-------|--------|----------|
| +1 engineer-week lost (leave) | −5 days | Use contingency; defer one P0 report |
| greytHR export rework | −5–10 days | Freeze schema deltas; HR cleansing sprint |
| Free CI minutes exhausted | −2–4 days friction | Local CI fallback; nightly only |
| Payroll “just one more feature” | Scope risk | Explicit No-Go; escalate to CEO |

---

## 10. Summary numbers (copy into executive decks)

| Number | Value | Label |
|--------|-------|-------|
| Gross person-days | 240 | **Fact** |
| Effective coding+delivery | 145–155 | **Estimate** |
| Contingency 15% | ~22–23 | **Estimate** |
| Commit-able P0 | ~127 (±5) | **Estimate** |
| Team | 4 | **Fact** |
| Sprints | 6 × 2 weeks | **Fact** (calendar) |

---

*No ROI invented. Capacity is a planning instrument, not accounting precision.*
