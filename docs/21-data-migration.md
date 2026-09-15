# 21 — Data Migration (greytHR → PeopleOS)

**Product:** PeopleOS  
**Source system:** greytHR (incumbent)  
**Primary transfer mode for MVP:** **Excel / CSV exports** (not deep API sync)  
**Payroll:** Remains on greytHR for MVP — **do not migrate statutory payroll engine**  
**Evidence labels:** **Fact** | **Assumption** | **Estimate** | **Metric-to-measure**

**Related:** [22-deployment-guide.md](22-deployment-guide.md) · [23-risk-register.md](23-risk-register.md) · [16-testing-strategy.md](16-testing-strategy.md) · [27-change-management.md](27-change-management.md)

---

## 1. Objectives

1. Load a **pilot cohort** (and later full ~500 employees) of master data into PeopleOS with known quality  
2. Preserve leave balances and attendance history needed for P0 journeys  
3. Provide **reconciliation evidence** for Go/No-Go  
4. Enable **rollback** if cutover fails  

### Non-objectives (MVP)

- Continuous bi-directional sync with greytHR  
- Migrating payroll run results as system of record  
- Perfect historical forever-archive of all greytHR modules  
- Invented savings from “faster migration”

---

## 2. Scope by entity (P0)

| Entity | In P0 migrate? | Notes |
|--------|----------------|-------|
| Employees (master) | Yes | Core |
| Org units / departments | Yes | May simplify hierarchy |
| Manager relationships | Yes | Critical for workflow |
| Employment status / DOJ / DOL | Yes | As available |
| Leave types & balances | Yes | Policy may be re-configured then balances loaded |
| Leave request history | Partial | **Assumption**: open/pending + recent N months; full history optional |
| Attendance | Yes for pilot window | e.g. last 3–12 months — **Assumption** confirm with HR |
| Documents | Partial | Metadata + selective files; bulk binary may be phased |
| Users/credentials | Recreate | Prefer invite/reset; do not import greytHR password hashes |
| Payroll / statutory | **No** | Stay in greytHR |
| Performance / recruitment | **No** | Out of P0 product scope |

---

## 3. End-to-end process

```text
Discovery → Mapping → Cleansing → Transformation → Validation
    → Import (dry-run) → Reconciliation → Fix → Import (cutover)
    → Duplicate management → Post-load checks → Rollback plan ready
```

---

## 4. Discovery

### 4.1 Activities (Weeks 1–2, ongoing)

| Activity | Owner | Output |
|----------|-------|--------|
| List greytHR export screens/reports available | HR + FS/QA | Inventory sheet |
| Capture sample Excel/CSV (sanitized) | HR | `fixtures/greythr/samples/` |
| Note mandatory vs optional fields | BE + HR | Field dictionary |
| Identify IDs (employee code, email) | Lead | Natural keys decision |
| Volume counts (~500 emp) | HR | **Fact** approx headcount; exact count **Metric-to-measure** at extract |

### 4.2 Discovery checklist

- [ ] Employee export columns documented  
- [ ] Leave balance export documented  
- [ ] Attendance export documented  
- [ ] Org/department list documented  
- [ ] Encoding (UTF-8 vs Excel default) known  
- [ ] Date formats known (DD/MM/YYYY vs ISO) — India context **Assumption** DD/MM/YYYY in exports  
- [ ] Inactive/terminated employee inclusion rules agreed  

---

## 5. Mapping

Maintain a living workbook: `docs/migration/greythr-field-map.md` (or xlsx controlled copy).

### 5.1 Mapping table template

| greytHR column | Sample | PeopleOS field | Transform | Mandatory | Notes |
|----------------|--------|----------------|-----------|-----------|-------|
| Employee No | E123 | `employee_code` | trim/upper | Yes | Natural key |
| Official Email | a@co | `work_email` | lower | Yes | Login correlation |
| … | | | | | |

### 5.2 Key design (**Assumption** until ADR)

| Key | Choice |
|-----|--------|
| Business key | `employee_code` from greytHR |
| Surrogate | UUID/serial internal |
| Manager link | Map via manager employee_code post-load pass |
| Leave type | Map codes via translation table; unknown → quarantine |

### 5.3 Unmapped fields

- Park in `migration_quarantine` or `custom_attributes` JSON **only if needed**  
- Prefer explicit drop with HR sign-off over silent loss  

---

## 6. Cleansing

### 6.1 Typical issues (**Estimate** based on common HRIS exports — validate on real files)

| Issue | Action |
|-------|--------|
| Duplicate emails | HR decides survivor; others unique-ify or deactivate |
| Missing manager | Assign interim HR manager or blank with flag |
| Invalid dates | Reject row to quarantine |
| Mixed status values | Normalize to Active/Inactive enum |
| Trailing spaces / Excel formulas | Strip; export values only |
| Personal phones in wrong column | HR fix source |

### 6.2 Ownership

**HR owns data correctness.** Engineering owns transforms and loaders. Do not silently “fix” legal names or DOJ without HR rule.

### 6.3 Cleansing SLA

Pilot extract freeze date = cutover − N days (**Assumption**: 3–5 business days) after which only delta fixes allowed.

---

## 7. Transformation

| Transform | Example |
|-----------|---------|
| Date parse | Excel serial / `DD/MM/YYYY` → ISO date UTC+IST business date |
| Phone | E.164-ish normalize if used |
| Leave balance | Decimal precision rules (0.5 day) |
| Attendance codes | Present/Absent/Half/WFH → enum |
| Org | Flatten deep trees if UX MVP limited |

Implement transforms in **versioned code** (not one-off Excel macros as sole path). Macros may assist HR cleansing but loader is source of truth.

---

## 8. Validation (pre-import)

### 8.1 Row-level

- Required fields present  
- Enum membership  
- Referential: manager code exists or null allowed  
- Uniqueness: employee_code, work_email  

### 8.2 File-level

- Row count vs HR control total  
- Checksum/hash of source file recorded  
- Schema version of template matched  

### 8.3 Output

Validation report: `accepted`, `rejected`, `quarantined` with reasons. **No import of rejected rows.**

---

## 9. Import

### 9.1 Modes

| Mode | Use |
|------|-----|
| Dry-run | Parse+validate+simulate counts; **no** commit (or txn rollback) |
| Upsert | By `employee_code` for re-runs |
| Cutover | Maintenance window; write enabled |

### 9.2 Order of load

1. Org units  
2. Employees (without manager_id)  
3. Patch manager_id  
4. Leave types/policies (or seed then map)  
5. Leave balances  
6. Leave requests (if in scope)  
7. Attendance  
8. Document metadata (files optional second wave)  

### 9.3 Idempotency

Re-running the same file must not duplicate attendance days or double leave balances. Use natural keys + import batch IDs.

### 9.4 Batch audit

Every import writes: operator, timestamp, file hash, counts, errors artifact path.

---

## 10. Reconciliation

### 10.1 Control totals (**Metric-to-measure**)

| Control | greytHR | PeopleOS | Tolerance |
|---------|---------|----------|-----------|
| Active employees | N1 | N2 | 0 unless explained |
| Inactive included | N3 | N4 | Agreed |
| Sum leave balance (CL) | S1 | S2 | 0 or ≤0.5 day explain |
| Attendance rows month M | A1 | A2 | 0 unexplained |
| Employees missing manager | M1 | M2 | Track to zero for pilot managers |

### 10.2 Spot checks

HR spot-checks **≥20** random employees (profile, balance, manager) — **Assumption** sample size.

### 10.3 Sign-off

Reconciliation sheet signed by HR + FS/QA + Lead before Go.

---

## 11. Duplicate management

| Duplicate type | Detection | Resolution |
|----------------|-----------|------------|
| Same employee_code | Reject second | Keep first / HR merge |
| Same email different codes | Quarantine | HR decides |
| Fuzzy name match | Report only | No auto-merge in MVP |

**Never auto-merge** employees without HR confirmation.

---

## 12. Rollback

### 12.1 Preconditions

- DB snapshot / dump taken **immediately before** cutover import  
- Previous app image known  
- Communication channel ready  

### 12.2 Rollback options

| Level | Action | Data impact |
|-------|--------|-------------|
| Flag | Disable PeopleOS pilot access; users stay on greytHR | None in greytHR |
| App | Redeploy prior empty/pilot build | Soft |
| DB | Restore pre-import snapshot | Lose post-import writes |
| Partial | Delete by `import_batch_id` if designed | Preferred for failed load |

### 12.3 Drill

Execute backup/restore drill in Week 11 on non-pilot data — exit criterion.

---

## 13. Security & compliance

- Sanitize fixtures committed to git (no Aadhaar/PAN/bank full numbers)  
- Production extracts only on locked HR/FS machines  
- Encrypt at rest on pilot host volumes (**Assumption** BitLocker/LUKS as available)  
- Access to migration files: HR + Lead + FS/QA only  
- After cutover, retain source extracts per company retention policy (define with HR/legal — **Assumption** pending)  

---

## 14. Timeline alignment

| Week | Migration work |
|------|----------------|
| 1–2 | Discovery, samples, draft map |
| 3–4 | Template finalization; loader skeleton |
| 5–7 | Employee+leave map validated against schema |
| 8 | Attendance import path |
| 9–10 | Full pilot file cleansing with HR |
| 11 | Dry-run #1, #2; reconciliation |
| 12 | Cutover load; spot checks; hypercare fixes |

---

## 15. Roles

| Role | Responsibility |
|------|----------------|
| HR | Exports, cleansing decisions, sign-off |
| FS/QA | Tooling, dry-runs, reports, ops |
| BE | Schema constraints, domain validation |
| Lead | Key design, Go recommendation |
| FE | Rarely involved except showing loaded data UX |

---

## 16. Exit criteria (migration ready for Go)

- [ ] Field map signed  
- [ ] Two successful dry-runs on pilot dataset  
- [ ] Reconciliation within tolerances  
- [ ] Duplicate report empty or accepted exceptions  
- [ ] Rollback drill done  
- [ ] Credentials/invite plan for pilot users ready  

---

## 17. Explicit honesty labels

| Statement | Label |
|-----------|-------|
| ~500 employees company size | **Fact** (stated context); exact migrate count measured at extract |
| Excel/CSV is primary path | **Assumption** pending greytHR admin confirmation of export capability |
| Effort 8–10 person-days engineering + HR time | **Estimate** ([capacity-sheet](appendices/capacity-sheet.md)) |
| Data quality will need HR cleansing | **Assumption** (typical); severity unknown until discovery |

---

*Migration success is a joint HR–Engineering outcome. Engineering cannot “code away” bad source data.*
