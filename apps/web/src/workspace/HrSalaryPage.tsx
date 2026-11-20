import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { showToast } from '../ui/toast';
import './hr-master.css';
import './salary.css';
import { salaryFromCtc } from './ctcSalary';
import { SalarySheet } from './SalarySheet';
import {
  SALARY_MONTH_TEMPLATE,
  SALARY_TEMPLATE,
  currentSalaryMonth,
  fetchSalaryMonth,
  formatSalary,
  generateSalaries,
  approvePayroll,
  lockSalaries,
  saveSalaryMonth,
  saveSalaryStructure,
  uploadSalaryCsv,
  type SalaryRosterRow,
} from './salaryApi';

function formatDays(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function salaryState(row: SalaryRosterRow) {
  if (!row.line || row.line.status === 'preview') return row.structure ? 'not generated' : 'no structure';
  if (row.line.submittedToFinance && row.line.payoutGenerated) return 'payout ready';
  if (row.line.submittedToFinance) return 'with finance';
  return row.line.status;
}

type StructureForm = {
  ctc: string;
  monthlyGross: string;
  basic: string;
  hra: string;
  da: string;
  otherAllowances: string;
  statutoryBonus: string;
  dailyAllowance: string;
  gratuity: string;
  leaveEncashment: string;
  pfOnActual: boolean;
  taxRegime: 'new' | 'old';
  ptMonthly: string;
  annualDeductions: string;
  rentPaidAnnual: string;
  isMetro: boolean;
  ytdTaxable: string;
  ytdTds: string;
  ytdPt: string;
  insurance: string;
};

type MonthForm = {
  lopDays: string;
  bonus: string;
  overtime: string;
  incentive: string;
  arrears: string;
  loanRecovery: string;
  advanceRecovery: string;
  otherDeduction: string;
};

const emptyStructure = (): StructureForm => ({
  ctc: '',
  monthlyGross: '',
  basic: '',
  hra: '',
  da: '0',
  otherAllowances: '0',
  statutoryBonus: '0',
  dailyAllowance: '0',
  gratuity: '0',
  leaveEncashment: '0',
  pfOnActual: false,
  taxRegime: 'new',
  ptMonthly: '0',
  annualDeductions: '0',
  rentPaidAnnual: '0',
  isMetro: false,
  ytdTaxable: '0',
  ytdTds: '0',
  ytdPt: '0',
  insurance: '0',
});

const emptyMonth = (): MonthForm => ({
  lopDays: '0',
  bonus: '0',
  overtime: '0',
  incentive: '0',
  arrears: '0',
  loanRecovery: '0',
  advanceRecovery: '0',
  otherDeduction: '0',
});

function num(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function rosterGross(row: SalaryRosterRow) {
  return row.line?.gross ?? row.structure?.monthlyGross ?? 0;
}

function structureBody(structure: StructureForm) {
  const pay = salaryFromCtc(num(structure.ctc));
  return {
    ctc: pay.ctc,
    monthlyGross: pay.gross,
    basic: pay.basic,
    hra: pay.hra,
    da: 0,
    otherAllowances: 0,
    statutoryBonus: pay.statutoryBonus,
    dailyAllowance: 0,
    gratuityMonthly: pay.gratuity,
    leaveEncashment: pay.leaveEncashment,
    pfOnActual: false,
    taxRegime: structure.taxRegime,
    ptMonthly: num(structure.ptMonthly),
    annualDeductions: num(structure.annualDeductions),
    // Rent / metro are saved via tax declaration approve; omit here so older APIs don't 400.
    ytdTaxable: num(structure.ytdTaxable),
    ytdTds: num(structure.ytdTds),
    ytdPt: num(structure.ytdPt),
    insurance: num(structure.insurance),
  };
}

function CalculatedPay({
  ctc,
  disabled,
  tds,
  net,
}: {
  ctc: string;
  disabled: boolean;
  tds?: number;
  net?: number;
}) {
  const pay = salaryFromCtc(num(ctc));
  const rows: Array<[string, number]> = [
    ['Basic this month', pay.basic],
    ['HRA this month', pay.hra],
    ['PF this month', pay.pf],
    ['Statutory bonus this month', pay.statutoryBonus],
    ['Special allowance this month', pay.special],
    ['Gratuity this month', pay.gratuity],
    ['Leave encashment this month', pay.leaveEncashment],
    ['Gross this month', pay.gross],
    ['TDS this month', tds ?? 0],
    ['Net this month', net ?? Math.max(0, pay.gross - pay.pf)],
  ];
  return (
    <>
      {rows.map(([label, value]) => (
        <label key={label}>
          {label}
          <input value={String(value)} readOnly disabled={disabled} />
        </label>
      ))}
    </>
  );
}

function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function HrSalaryPage() {
  const { hasRole } = useAuth();
  const canControlPayroll = hasRole('HRH') || hasRole('SYS');
  const [month, setMonth] = useState(currentSalaryMonth);
  const [rows, setRows] = useState<SalaryRosterRow[]>([]);
  const [monthApproved, setMonthApproved] = useState(false);
  const [monthLocked, setMonthLocked] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [structure, setStructure] = useState<StructureForm>(emptyStructure);
  const [adjust, setAdjust] = useState<MonthForm>(emptyMonth);
  const [uploadKind, setUploadKind] = useState<'structure' | 'month'>('structure');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = rows.find((row) => row.employeeId === selectedId) ?? null;
  const monthGenerated = rows.some((row) => row.line?.submittedToFinance);

  async function load(nextMonth = month) {
    const data = await fetchSalaryMonth(nextMonth);
    setRows(data.employees);
    setMonthApproved(data.approved);
    setMonthLocked(data.locked);
    setError(null);
  }

  useEffect(() => {
    load(month).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load salary.'));
    // Reload when the payroll month changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  useEffect(() => {
    if (!selected) return;
    const saved = selected.structure;
    setStructure(
      saved
        ? {
            ctc: String(saved.ctc || (saved.basic ? saved.basic * 2 * 12 : saved.monthlyGross * 12)),
            monthlyGross: String(saved.monthlyGross),
            basic: String(saved.basic),
            hra: String(saved.hra),
            da: String(saved.da),
            otherAllowances: String(saved.otherAllowances),
            statutoryBonus: String(saved.statutoryBonus ?? 0),
            dailyAllowance: String(saved.dailyAllowance ?? 0),
            gratuity: String(saved.gratuityMonthly ?? 0),
            leaveEncashment: String(saved.leaveEncashment ?? 0),
            pfOnActual: saved.pfOnActual,
            taxRegime: saved.taxRegime,
            ptMonthly: String(saved.ptMonthly),
            annualDeductions: String(saved.annualDeductions),
            rentPaidAnnual: String(saved.rentPaidAnnual ?? 0),
            isMetro: Boolean(saved.isMetro),
            ytdTaxable: String(saved.ytdTaxable),
            ytdTds: String(saved.ytdTds),
            ytdPt: String(saved.ytdPt),
            insurance: String(saved.insurance ?? 0),
          }
        : emptyStructure(),
    );
    const line = selected.line;
    setAdjust(
      line
        ? {
            lopDays: String(line.lopDays),
            bonus: String(line.bonus),
            overtime: String(line.overtime),
            incentive: String(line.incentive),
            arrears: String(line.arrears),
            loanRecovery: String(line.loanRecovery ?? 0),
            advanceRecovery: String(line.advanceRecovery ?? 0),
            otherDeduction: String(line.otherDeduction),
          }
        : emptyMonth(),
    );
  }, [selected]);

  const totals = useMemo(() => {
    return rows.reduce(
      (sum, row) => ({
        gross: sum.gross + rosterGross(row),
        net: sum.net + (row.line?.netPay ?? 0),
        tds: sum.tds + (row.line?.tds ?? 0),
      }),
      { gross: 0, net: 0, tds: 0 },
    );
  }, [rows]);

  async function persistAndCalculate() {
    if (!selected) return;
    await saveSalaryStructure(selected.employeeId, structureBody(structure));
    await saveSalaryMonth(selected.employeeId, {
      month,
      lopDays: num(adjust.lopDays),
      bonus: num(adjust.bonus),
      overtime: num(adjust.overtime),
      incentive: num(adjust.incentive),
      arrears: num(adjust.arrears),
      loanRecovery: num(adjust.loanRecovery),
      advanceRecovery: num(adjust.advanceRecovery),
      otherDeduction: num(adjust.otherDeduction),
    });
    await load();
  }

  async function onSaveStructure(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await persistAndCalculate();
      showToast('Structure saved and TDS calculated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save structure.');
    } finally {
      setBusy(false);
    }
  }

  async function onCalculate(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await persistAndCalculate();
      showToast('Salary calculated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not calculate salary.');
    } finally {
      setBusy(false);
    }
  }

  async function onGenerate() {
    setBusy(true);
    try {
      const result = await generateSalaries(month);
      await load();
      const problem = result.errors[0]?.message;
      showToast(
        problem
          ? `Sent ${result.generated} to Finance. ${problem}`
          : `Sent ${result.generated} salary line${result.generated === 1 ? '' : 's'} to Finance`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate salaries.');
    } finally {
      setBusy(false);
    }
  }

  async function onApprove() {
    setBusy(true);
    try {
      const result = await approvePayroll(month);
      await load();
      showToast(`Approved ${result.employees} salaries for bank transfer`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve payroll.');
    } finally {
      setBusy(false);
    }
  }

  async function onLock() {
    setBusy(true);
    try {
      const result = await lockSalaries(month, !monthLocked);
      await load();
      showToast(monthLocked ? `Unlocked ${result.count} lines` : `Locked ${result.count} lines`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not lock the month.');
    } finally {
      setBusy(false);
    }
  }

  async function onUpload(file: File) {
    setBusy(true);
    try {
      const csv = await file.text();
      const result = await uploadSalaryCsv(uploadKind, csv, month);
      await load();
      const problem = result.errors[0];
      showToast(
        problem
          ? `Updated ${result.updated}. Row ${problem.row}: ${problem.message}`
          : `Updated ${result.updated} employee${result.updated === 1 ? '' : 's'}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the file.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hr-master salary-screen">
      <div className="hr-master-bar">
        <div className="salary-stats">
          <div>
            <span>Gross</span>
            <strong>{formatSalary(totals.gross)}</strong>
          </div>
          <div>
            <span>Net</span>
            <strong>{formatSalary(totals.net)}</strong>
          </div>
          <div>
            <span>TDS</span>
            <strong>{formatSalary(totals.tds)}</strong>
          </div>
        </div>
        <div className="salary-actions">
          <div className="salary-month-row">
            <label>
              Month
              <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            </label>
            <button
              type="button"
              className="ess-btn ess-btn-primary"
              disabled={busy || monthGenerated}
              title={monthGenerated ? 'This month is already generated.' : undefined}
              onClick={() => void onGenerate()}
            >
              Generate month
            </button>
          </div>
          {canControlPayroll ? (
            <button
              type="button"
              className="ess-btn"
              disabled={busy || !monthGenerated || monthApproved}
              title={monthApproved ? 'This month is already approved.' : undefined}
              onClick={() => void onApprove()}
            >
              Approve for bank transfer
            </button>
          ) : null}
          {canControlPayroll ? (
            <button
              type="button"
              className="ess-btn"
              disabled={busy || !monthGenerated || monthLocked}
              title={monthLocked ? 'This month is already locked.' : undefined}
              onClick={() => void onLock()}
            >
              Lock month
            </button>
          ) : null}
          {canControlPayroll && monthLocked ? (
            <button type="button" className="ess-btn" disabled={busy} onClick={() => void onLock()}>
              Unlock month
            </button>
          ) : null}
          {monthGenerated || monthApproved || monthLocked ? (
            <p className="salary-note salary-status">
              {[
                monthGenerated ? 'This month is already generated.' : '',
                monthApproved ? 'This month is already approved.' : '',
                monthLocked ? 'This month is already locked.' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            </p>
          ) : null}
        </div>
      </div>

      <div className="hr-master-filters">
        <select value={uploadKind} onChange={(event) => setUploadKind(event.target.value as 'structure' | 'month')}>
          <option value="structure">Salary structure CSV</option>
          <option value="month">This month&apos;s extras CSV</option>
        </select>
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="Upload salary CSV"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void onUpload(file);
          }}
        />
        <button
          type="button"
          className="ess-btn ess-btn-ghost"
          onClick={() =>
            downloadText(
              uploadKind === 'structure' ? 'salary-structure-template.csv' : 'salary-month-template.csv',
              uploadKind === 'structure' ? SALARY_TEMPLATE : SALARY_MONTH_TEMPLATE,
            )
          }
        >
          Download template
        </button>
      </div>
      {error ? <p className="ess-alert">{error}</p> : null}

      <div className="salary-layout">
        <div className="salary-scroll">
          <table className="salary-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Employee</th>
                <th>Gross</th>
                <th>PF</th>
                <th>TDS</th>
                <th>Net</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>No employees yet. Add people before uploading salary.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.employeeId}
                    className={row.employeeId === selectedId ? 'is-selected' : undefined}
                    onClick={() => setSelectedId(row.employeeId)}
                  >
                    <td>{row.employeeCode}</td>
                    <td>
                      {row.name}
                      <div className="salary-note">{row.designation || 'No designation'}</div>
                    </td>
                    <td>{row.structure || row.line ? formatSalary(rosterGross(row)) : '—'}</td>
                    <td>{row.line ? formatSalary(row.line.eePf) : row.structure ? formatSalary(salaryFromCtc(row.structure.ctc || row.structure.basic * 24).pf) : '—'}</td>
                    <td>{row.line ? formatSalary(row.line.tds) : '—'}</td>
                    <td>
                      {row.line
                        ? formatSalary(row.line.netPay)
                        : row.structure
                          ? formatSalary(
                              Math.max(
                                0,
                                (row.structure.monthlyGross || salaryFromCtc(row.structure.ctc || 0).gross) -
                                  salaryFromCtc(row.structure.ctc || row.structure.basic * 24).pf -
                                  (row.structure.insurance ?? 0),
                              ),
                            )
                          : '—'}
                    </td>
                    <td>{salaryState(row)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form key={selected?.employeeId ?? 'none'} className="hr-panel salary-editor" onSubmit={onSaveStructure}>
          <h2>{selected ? selected.name : 'Salary structure'}</h2>
          {selected?.line?.warning ? <p className="ess-alert">{selected.line.warning}</p> : null}
          {!selected ? <p className="salary-note">Select an employee and enter CTC.</p> : null}
          <label>
            CTC per year
            <input
              inputMode="numeric"
              value={structure.ctc}
              onChange={(event) => setStructure({ ...structure, ctc: event.target.value })}
              required
              disabled={!selected}
            />
          </label>
          <CalculatedPay
            ctc={structure.ctc}
            disabled={!selected}
            tds={selected?.line?.tds}
            net={selected?.line?.netPay}
          />
          <label>
            Insurance this month
            <input
              inputMode="numeric"
              value={structure.insurance}
              onChange={(event) => setStructure({ ...structure, insurance: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label>
            Tax regime
            <select
              value={structure.taxRegime}
              onChange={(event) => setStructure({ ...structure, taxRegime: event.target.value as 'new' | 'old' })}
              disabled={!selected}
            >
              <option value="new">New regime</option>
              <option value="old">Old regime</option>
            </select>
          </label>
          <label>
            Professional tax / month
            <input
              inputMode="numeric"
              value={structure.ptMonthly}
              onChange={(event) => setStructure({ ...structure, ptMonthly: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label>
            Old-regime deductions (80C, max ₹1,50,000)
            <input
              inputMode="numeric"
              value={structure.annualDeductions}
              onChange={(event) => setStructure({ ...structure, annualDeductions: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label>
            Annual rent paid (HRA exemption)
            <input
              inputMode="numeric"
              value={structure.rentPaidAnnual}
              onChange={(event) => setStructure({ ...structure, rentPaidAnnual: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label className="ess-check">
            <input
              type="checkbox"
              checked={structure.isMetro}
              onChange={(event) => setStructure({ ...structure, isMetro: event.target.checked })}
              disabled={!selected}
            />
            Metro city
          </label>
          <label>
            Brought-forward taxable pay
            <input
              inputMode="numeric"
              value={structure.ytdTaxable}
              onChange={(event) => setStructure({ ...structure, ytdTaxable: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label>
            Brought-forward TDS
            <input
              inputMode="numeric"
              value={structure.ytdTds}
              onChange={(event) => setStructure({ ...structure, ytdTds: event.target.value })}
              disabled={!selected}
            />
          </label>
          <button type="submit" className="ess-btn ess-btn-primary" disabled={!selected || busy}>
            Save structure
          </button>
          <h2>This month</h2>
          <p className="salary-note">
            These amounts are for this month only. Bonus here is a one-time extra. Statutory bonus is already inside monthly gross.
            Loan recovery, advance recovery, and other deduction each come off net pay on their own payslip line, and a
            zero amount stays off the payslip.
          </p>
          {selected?.attendance ? (
            <dl className="salary-attendance">
              <div>
                <dt>Total working days</dt>
                <dd>{formatDays(selected.attendance.workingDays)}</dd>
              </div>
              <div>
                <dt>Present</dt>
                <dd>{formatDays(selected.attendance.present)}</dd>
              </div>
              <div>
                <dt>Paid leave</dt>
                <dd>{formatDays(selected.attendance.paidLeave)}</dd>
              </div>
              <div>
                <dt>Unpaid leave</dt>
                <dd>{formatDays(selected.attendance.unpaidLeave)}</dd>
              </div>
              <div>
                <dt>Pending leave deducted</dt>
                <dd>{formatDays(selected.attendance.pendingLeaveDays)}</dd>
              </div>
              <div>
                <dt>Total payable days</dt>
                <dd>{formatDays(selected.attendance.payableDays)}</dd>
              </div>
            </dl>
          ) : null}
          <p className="salary-note">
            Payable days come from attendance. Pending leave is deducted even before approval. Approved paid leave is
            not deducted. Weekends and holidays are not working days. A day with no attendance row stays present until
            HR marks it.
            {selected?.attendance?.note ? ` ${selected.attendance.note}` : ''}
          </p>
          <label>
            Bonus
            <input inputMode="numeric" value={adjust.bonus} onChange={(event) => setAdjust({ ...adjust, bonus: event.target.value })} disabled={!selected} />
          </label>
          <label>
            Overtime
            <input inputMode="numeric" value={adjust.overtime} onChange={(event) => setAdjust({ ...adjust, overtime: event.target.value })} disabled={!selected} />
          </label>
          <label>
            Incentive
            <input inputMode="numeric" value={adjust.incentive} onChange={(event) => setAdjust({ ...adjust, incentive: event.target.value })} disabled={!selected} />
          </label>
          <label>
            Arrears
            <input inputMode="numeric" value={adjust.arrears} onChange={(event) => setAdjust({ ...adjust, arrears: event.target.value })} disabled={!selected} />
          </label>
          <label>
            Loan recovery
            <input
              inputMode="numeric"
              value={adjust.loanRecovery}
              onChange={(event) => setAdjust({ ...adjust, loanRecovery: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label>
            Advance recovery
            <input
              inputMode="numeric"
              value={adjust.advanceRecovery}
              onChange={(event) => setAdjust({ ...adjust, advanceRecovery: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label>
            Other deduction
            <input
              inputMode="numeric"
              value={adjust.otherDeduction}
              onChange={(event) => setAdjust({ ...adjust, otherDeduction: event.target.value })}
              disabled={!selected}
            />
          </label>
          <button type="button" className="ess-btn" disabled={!selected || busy} onClick={(event) => void onCalculate(event)}>
            Calculate this employee
          </button>
          {selected?.line ? (
            <p className="salary-note">
              Net {formatSalary(selected.line.netPay)}. PF wages {formatSalary(selected.line.pfWages)}.
            </p>
          ) : null}
        </form>
      </div>
      {selected?.statement ? <SalarySheet statement={selected.statement} /> : null}
    </div>
  );
}
