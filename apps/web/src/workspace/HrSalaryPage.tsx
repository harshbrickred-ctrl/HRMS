import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { showToast } from '../ui/toast';
import './hr-master.css';
import './salary.css';
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
  if (row.line?.submittedToFinance && row.line.payoutGenerated) return 'payout ready';
  if (row.line?.submittedToFinance) return 'with finance';
  if (row.line) return row.line.status;
  return row.structure ? 'not generated' : 'no structure';
}

type StructureForm = {
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
  ytdTaxable: string;
  ytdTds: string;
  ytdPt: string;
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
  ytdTaxable: '0',
  ytdTds: '0',
  ytdPt: '0',
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
  return row.structure?.monthlyGross ?? row.line?.gross ?? 0;
}

function structureBody(structure: StructureForm) {
  return {
    monthlyGross: num(structure.monthlyGross),
    basic: structure.basic === '' ? undefined : num(structure.basic),
    hra: structure.hra === '' ? undefined : num(structure.hra),
    da: num(structure.da),
    otherAllowances: num(structure.otherAllowances),
    statutoryBonus: num(structure.statutoryBonus),
    dailyAllowance: num(structure.dailyAllowance),
    gratuityMonthly: num(structure.gratuity),
    leaveEncashment: num(structure.leaveEncashment),
    pfOnActual: structure.pfOnActual,
    taxRegime: structure.taxRegime,
    ptMonthly: num(structure.ptMonthly),
    annualDeductions: num(structure.annualDeductions),
    ytdTaxable: num(structure.ytdTaxable),
    ytdTds: num(structure.ytdTds),
    ytdPt: num(structure.ytdPt),
  };
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
  const [month, setMonth] = useState(currentSalaryMonth);
  const [rows, setRows] = useState<SalaryRosterRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [structure, setStructure] = useState<StructureForm>(emptyStructure);
  const [adjust, setAdjust] = useState<MonthForm>(emptyMonth);
  const [uploadKind, setUploadKind] = useState<'structure' | 'month'>('structure');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = rows.find((row) => row.employeeId === selectedId) ?? null;
  const locked = rows.some((row) => row.line?.status === 'locked');

  async function load(nextMonth = month) {
    const data = await fetchSalaryMonth(nextMonth);
    setRows(data);
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
            ytdTaxable: String(saved.ytdTaxable),
            ytdTds: String(saved.ytdTds),
            ytdPt: String(saved.ytdPt),
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

  async function onSaveStructure(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    try {
      await saveSalaryStructure(selected.employeeId, structureBody(structure));
      await load();
      showToast('Salary structure saved');
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
      const result = await lockSalaries(month, !locked);
      await load();
      showToast(locked ? `Unlocked ${result.count} lines` : `Locked ${result.count} lines`);
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
    <div className="hr-master">
      <div className="hr-master-bar">
        <div>
          <h1>Salary</h1>
          <p className="hr-master-lead">
            Set the fixed structure, then add this month&apos;s incentive, overtime, bonus, loan recovery, advance
            recovery, or other deduction. Generate month sends that payroll to Finance for payout.
          </p>
        </div>
        <div className="salary-actions">
          <label>
            Month
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
          <button type="button" className="ess-btn ess-btn-primary" disabled={busy} onClick={() => void onGenerate()}>
            Generate month
          </button>
          <button type="button" className="ess-btn" disabled={busy} onClick={() => void onApprove()}>
            Approve for bank transfer
          </button>
          <button type="button" className="ess-btn" disabled={busy || rows.every((row) => !row.line)} onClick={() => void onLock()}>
            {locked ? 'Unlock month' : 'Lock month'}
          </button>
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
        <span className="salary-note">
          Gross {formatSalary(totals.gross)} · Net {formatSalary(totals.net)} · TDS {formatSalary(totals.tds)}
        </span>
      </div>
      {error ? <p className="ess-alert">{error}</p> : null}
      <p className="salary-note">
        Leave basic or HRA blank to use 50% basic and 40% HRA. One-time bonus tax is deducted in the month it is paid.
        Brought-forward YTD is only for months not generated here. A locked month is not overwritten.
      </p>

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
                    <td>{row.line ? formatSalary(row.line.eePf) : '—'}</td>
                    <td>{row.line ? formatSalary(row.line.tds) : '—'}</td>
                    <td>{row.line ? formatSalary(row.line.netPay) : '—'}</td>
                    <td>{salaryState(row)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form className="hr-panel salary-editor" onSubmit={onSaveStructure}>
          <h2>{selected ? selected.name : 'Salary structure'}</h2>
          {selected?.line?.warning ? <p className="ess-alert">{selected.line.warning}</p> : null}
          {!selected ? <p className="salary-note">Select an employee to set gross, basic, and tax regime.</p> : null}
          <label>
            Monthly gross
            <input
              inputMode="numeric"
              value={structure.monthlyGross}
              onChange={(event) => setStructure({ ...structure, monthlyGross: event.target.value })}
              required
              disabled={!selected}
            />
          </label>
          <label>
            Basic (blank = 50%)
            <input
              inputMode="numeric"
              value={structure.basic}
              onChange={(event) => setStructure({ ...structure, basic: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label>
            HRA (blank = 40% of basic)
            <input
              inputMode="numeric"
              value={structure.hra}
              onChange={(event) => setStructure({ ...structure, hra: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label>
            DA
            <input inputMode="numeric" value={structure.da} onChange={(event) => setStructure({ ...structure, da: event.target.value })} disabled={!selected} />
          </label>
          <label>
            Special allowance
            <input
              inputMode="numeric"
              value={String(
                num(structure.monthlyGross) -
                  num(structure.basic) -
                  num(structure.hra) -
                  num(structure.da) -
                  num(structure.otherAllowances) -
                  num(structure.statutoryBonus) -
                  num(structure.dailyAllowance),
              )}
              readOnly
              disabled={!selected}
            />
          </label>
          <label>
            Other allowances
            <input
              inputMode="numeric"
              value={structure.otherAllowances}
              onChange={(event) => setStructure({ ...structure, otherAllowances: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label>
            Statutory bonus
            <input
              inputMode="numeric"
              value={structure.statutoryBonus}
              onChange={(event) => setStructure({ ...structure, statutoryBonus: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label>
            Daily allowance
            <input
              inputMode="numeric"
              value={structure.dailyAllowance}
              onChange={(event) => setStructure({ ...structure, dailyAllowance: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label>
            Gratuity
            <input
              inputMode="numeric"
              value={structure.gratuity}
              onChange={(event) => setStructure({ ...structure, gratuity: event.target.value })}
              disabled={!selected}
            />
          </label>
          <label>
            Leave encashment
            <input
              inputMode="numeric"
              value={structure.leaveEncashment}
              onChange={(event) => setStructure({ ...structure, leaveEncashment: event.target.value })}
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
            <span>
              <input
                type="checkbox"
                checked={structure.pfOnActual}
                onChange={(event) => setStructure({ ...structure, pfOnActual: event.target.checked })}
                disabled={!selected}
              />{' '}
              PF on actual basic + DA, above the ceiling
            </span>
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
                <dt>Total payable days</dt>
                <dd>{formatDays(selected.attendance.payableDays)}</dd>
              </div>
            </dl>
          ) : null}
          <p className="salary-note">
            Payable days come from attendance and approved leave. Weekends and holidays are not working days. Payable
            days are present plus paid leave. A day with no attendance row stays present until HR marks it.
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
              Net {formatSalary(selected.line.netPay)}. Employer cost {formatSalary(selected.line.employerCost)}. PF wages{' '}
              {formatSalary(selected.line.pfWages)}.
            </p>
          ) : null}
        </form>
      </div>
      {selected?.statement ? <SalarySheet statement={selected.statement} /> : null}
    </div>
  );
}
