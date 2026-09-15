# 23 — Risk Register

Scoring: Probability (1–5) × Impact (1–5) = Score. Rank by score.

| ID | Risk | P | I | Score | Mitigation | Contingency | Owner |
|----|------|---|---|-------|------------|-------------|-------|
| R01 | Scope creep / feature overload | 5 | 5 | 25 | P0 freeze; weekly demo trade-offs | Descope P1 entirely | Lead + CEO sponsor |
| R02 | 12-week deadline slip | 4 | 5 | 20 | Critical path tracking; no payroll | Pilot with subset modules | Lead |
| R03 | Ambiguous HR workflows | 4 | 4 | 16 | Week 1–2 workshops; written rules | Default opinionated flows | HR Head + Lead |
| R04 | Temptation to build payroll | 4 | 5 | 20 | CEO condition; ADR | Keep greytHR payroll | CEO / Product |
| R05 | greytHR data quality / export gaps | 4 | 4 | 16 | Early export discovery; dry-run | Manual cleanse; phased import | HR + Backend |
| R06 | Dual-system confusion | 3 | 4 | 12 | Clear SoR matrix (PeopleOS vs greytHR) | Comms + training | HR Head |
| R07 | Security vulnerability / PII leak | 3 | 5 | 15 | Security design; tests; review gate | Delay go-live | Lead + Security |
| R08 | Free-tier CI limits | 3 | 3 | 9 | Self-hosted runner; fewer jobs | Pause noncritical CI | Full-stack/QA |
| R09 | Key-person dependency | 3 | 4 | 12 | Pairing; ADRs; code review | Cross-train | Lead |
| R10 | Low user adoption | 3 | 5 | 15 | UX focus; pilot; training | Extend pilot; fix UX | HR + Frontend |
| R11 | Attendance accuracy disputes | 4 | 3 | 12 | Correction workflow + audit | HR override path | HR |
| R12 | Underestimated workflow engine | 3 | 4 | 12 | v1 sequential only | Hard-code leave flow | Backend |
| R13 | Infra limitations on pilot VM | 2 | 3 | 6 | Capacity test Week 11 | Scale vertical | IT |
| R14 | Compliance/legal (DPDP) ambiguity | 3 | 4 | 12 | Minimize PII; legal consult | Delay sensitive docs | Compliance |
| R15 | SaaS distraction during MVP | 3 | 3 | 9 | Roadmap only; no billing code | Remove PRs | Lead |
| R16 | Integration delays (SMTP/AD) | 3 | 3 | 9 | Mailpit + local auth first | Manual email | IT |
| R17 | Production incidents post-go-live | 3 | 4 | 12 | Monitoring; on-call rota | Rollback image | Full-stack |
| R18 | Unrealistic executive expectations | 4 | 4 | 16 | This blueprint honesty | Rebaseline scope | CEO sponsor |

**Top 10 for CEO:** R01, R02, R04, R03, R05, R07, R10, R18, R06, R12.
