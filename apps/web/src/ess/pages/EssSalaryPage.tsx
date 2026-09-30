import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useEssData } from '../mock/EssDataContext';
import { ORGANIZATION } from '../mock/essMock';
import type { EssProfile, Holiday, Payslip, SalaryLine } from '../mock/essMock';

type Tab = 'payslips' | 'reimburse' | 'ytd' | 'pf';

const TABS: Array<[Tab, string]> = [
  ['payslips', 'Payslip'],
  ['reimburse', 'Reimbursements'],
  ['ytd', 'Year to date'],
  ['pf', 'Provident fund'],
];

function lineTotal(lines: SalaryLine[]) {
  return lines.reduce((sum, line) => sum + line.amount, 0);
}

function grossPay(slip: Payslip) {
  return lineTotal(slip.earnings);
}

function deductionTotal(slip: Payslip) {
  return lineTotal(slip.deductions);
}

function netPay(slip: Payslip) {
  return grossPay(slip) - deductionTotal(slip);
}

function initialTab(value: string | null): Tab {
  if (value === 'reimburse' || value === 'ytd' || value === 'pf') return value;
  return 'payslips';
}

function paidDays(month: string, holidays: Holiday[]) {
  const [year, monthIndex] = month.split('-').map(Number);
  const holidaySet = new Set(holidays.map((holiday) => holiday.date));
  const last = new Date(year, monthIndex, 0).getDate();
  let days = 0;
  for (let day = 1; day <= last; day += 1) {
    const date = `${month}-${String(day).padStart(2, '0')}`;
    const weekday = new Date(year, monthIndex - 1, day).getDay();
    if (weekday !== 0 && weekday !== 6 && !holidaySet.has(date)) days += 1;
  }
  return days;
}

function fiscalYear(month: string) {
  const [year, monthIndex] = month.split('-').map(Number);
  const start = monthIndex >= 4 ? year : year - 1;
  return `Apr ${start} – Mar ${start + 1}`;
}

function panOf(profile: EssProfile) {
  return (
    profile.statutoryIds.find((item) => item.label === 'Permanent Account Number')?.value ?? '—'
  );
}

function labelsOf(slips: Payslip[], key: 'earnings' | 'deductions') {
  const labels: string[] = [];
  for (const slip of slips) {
    for (const line of slip[key]) {
      if (!labels.includes(line.label)) labels.push(line.label);
    }
  }
  return labels;
}

function amountOf(slip: Payslip, key: 'earnings' | 'deductions', label: string) {
  return slip[key].find((line) => line.label === label)?.amount ?? 0;
}

function downloadCsv(filename: string, rows: string[][]) {
  const body = rows
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function EssSalaryPage() {
  const { payslips, profile, holidays, salaryHidden, toggleSalaryHidden, showAmount } = useEssData();
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => initialTab(params.get('tab')));
  const latest = payslips[0];
  const [selectedId, setSelectedId] = useState(latest?.id ?? '');
  const selected = payslips.find((slip) => slip.id === selectedId) ?? latest;
  const chronological = useMemo(
    () => [...payslips].sort((a, b) => a.month.localeCompare(b.month)),
    [payslips],
  );

  const ytd = useMemo(
    () =>
      payslips.reduce(
        (sum, slip) => ({
          gross: sum.gross + grossPay(slip),
          deductions: sum.deductions + deductionTotal(slip),
          net: sum.net + netPay(slip),
        }),
        { gross: 0, deductions: 0, net: 0 },
      ),
    [payslips],
  );

  const yearLabel = latest ? fiscalYear(latest.month) : '';
  const pfCovered = profile.pfAccount.trim().length > 0 && !/not covered/i.test(profile.pfAccount);

  function downloadPayslip(slip: Payslip) {
    downloadCsv(`payslip-${slip.month}.csv`, [
      ['Payslip', slip.label],
      ...slip.earnings.map((line) => ['Earning', line.label, String(line.amount)]),
      ...slip.deductions.map((line) => ['Deduction', line.label, String(line.amount)]),
      ['Gross', String(grossPay(slip))],
      ['Deductions', String(deductionTotal(slip))],
      ['Net', String(netPay(slip))],
    ]);
  }

  function downloadYtd() {
    const header = ['Item', ...chronological.map((slip) => slip.label), 'Total'];
    const earningLabels = labelsOf(chronological, 'earnings');
    const deductionLabels = labelsOf(chronological, 'deductions');
    const rowFor = (label: string, key: 'earnings' | 'deductions') => {
      const amounts = chronological.map((slip) => amountOf(slip, key, label));
      const total = amounts.reduce((sum, amount) => sum + amount, 0);
      return [label, ...amounts.map(String), String(total)];
    };
    downloadCsv(`salary-ytd-${yearLabel.replaceAll(' ', '')}.csv`, [
      header,
      ['Income'],
      ...earningLabels.map((label) => rowFor(label, 'earnings')),
      ['Gross', ...chronological.map((slip) => String(grossPay(slip))), String(ytd.gross)],
      ['Deduction'],
      ...deductionLabels.map((label) => rowFor(label, 'deductions')),
      [
        'Total deductions',
        ...chronological.map((slip) => String(deductionTotal(slip))),
        String(ytd.deductions),
      ],
      ['Net', ...chronological.map((slip) => String(netPay(slip))), String(ytd.net)],
    ]);
  }

  return (
    <div className="ess-section-stack">
      <div className="ess-insights">
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Latest net</p>
          <p className="ess-insight-value">{latest ? showAmount(netPay(latest)) : '—'}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Deductions</p>
          <p className="ess-insight-value">{latest ? showAmount(deductionTotal(latest)) : '—'}</p>
        </article>
        <article className="ess-panel ess-insight">
          <p className="ess-muted">Year to date</p>
          <p className="ess-insight-value">{showAmount(ytd.net)}</p>
        </article>
      </div>
      {latest ? (
        <p className="ess-att-facts">
          <span>
            Latest credit <strong>{latest.label}</strong> · {profile.bankName}
          </span>
          <span>
            {yearLabel}
          </span>
        </p>
      ) : null}

      <section className="ess-panel">
        <div className="ess-att-toolbar">
          <h2>{TABS.find(([id]) => id === tab)?.[1]}</h2>
          <div className="ess-tabs" role="tablist" aria-label="Salary sections">
            {TABS.map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                className={tab === id ? 'ess-tab is-active' : 'ess-tab'}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="ess-salary-tools">
          {tab === 'payslips' && selected ? (
            <div className="ess-salary-months" role="listbox" aria-label="Payslip month">
              {payslips.map((slip) => (
                <button
                  key={slip.id}
                  type="button"
                  role="option"
                  aria-selected={slip.id === selected.id}
                  className={slip.id === selected.id ? 'is-selected' : undefined}
                  onClick={() => setSelectedId(slip.id)}
                >
                  <span>{slip.label}</span>
                  <strong>{showAmount(netPay(slip))}</strong>
                </button>
              ))}
            </div>
          ) : (
            <p className="ess-muted">{yearLabel}</p>
          )}
          <div className="ess-actions">
            {tab === 'payslips' && selected ? (
              <button type="button" className="ess-btn ess-btn-primary" onClick={() => downloadPayslip(selected)}>
                <Download size={16} aria-hidden="true" />
                Download
              </button>
            ) : null}
            {tab === 'ytd' || tab === 'pf' ? (
              <button type="button" className="ess-btn ess-btn-primary" onClick={downloadYtd}>
                <Download size={16} aria-hidden="true" />
                Download
              </button>
            ) : null}
            <button
              type="button"
              className="ess-btn ess-btn-ghost"
              aria-pressed={salaryHidden}
              onClick={toggleSalaryHidden}
            >
              {salaryHidden ? 'Show salary' : 'Hide salary'}
            </button>
          </div>
        </div>
        <p className="ess-muted">Sample figures for internal use. These are not payroll amounts.</p>

        {tab === 'payslips' && selected ? (
          <PayslipSheet
            slip={selected}
            profile={profile}
            paid={paidDays(selected.month, holidays)}
            annualCtc={grossPay(selected) * 12}
          />
        ) : null}

        {tab === 'reimburse' ? (
          <p className="ess-empty">No reimbursement payslips for {yearLabel}.</p>
        ) : null}

        {tab === 'ytd' ? <YtdStatement slips={chronological} holidays={holidays} /> : null}

        {tab === 'pf' ? (
          <PfStatement slips={chronological} profile={profile} covered={pfCovered} />
        ) : null}
      </section>
    </div>
  );
}

function PayslipSheet({
  slip,
  profile,
  paid,
  annualCtc,
}: {
  slip: Payslip;
  profile: EssProfile;
  paid: number;
  annualCtc: number;
}) {
  const { showAmount } = useEssData();
  return (
    <div className="ess-salary-sheet">
      <div className="ess-salary-books">
        <MoneyTable title="Earnings" lines={slip.earnings} total={grossPay(slip)} />
        <MoneyTable title="Deductions" lines={slip.deductions} total={deductionTotal(slip)} />
        <div className="ess-salary-netbar">
          <div>
            <p className="ess-muted">Gross</p>
            <p>{showAmount(grossPay(slip))}</p>
          </div>
          <div>
            <p className="ess-muted">Deductions</p>
            <p>{showAmount(deductionTotal(slip))}</p>
          </div>
          <div className="is-net">
            <p className="ess-muted">Net pay</p>
            <p>{showAmount(netPay(slip))}</p>
          </div>
        </div>
      </div>
      <aside className="ess-salary-id">
        <h3>Employee details</h3>
        <dl>
          <div>
            <dt>Name</dt>
            <dd>
              {profile.firstName} {profile.lastName}
            </dd>
          </div>
          <div>
            <dt>Employee id</dt>
            <dd>{profile.employeeCode}</dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>{ORGANIZATION.name}</dd>
          </div>
          <div>
            <dt>Organization code</dt>
            <dd>{ORGANIZATION.code}</dd>
          </div>
          <div>
            <dt>Team</dt>
            <dd>{profile.teamName}</dd>
          </div>
          <div>
            <dt>Designation</dt>
            <dd>{profile.title}</dd>
          </div>
          <div>
            <dt>Grade</dt>
            <dd>{profile.grade}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{profile.department}</dd>
          </div>
          <div>
            <dt>Location</dt>
            <dd>{profile.location}</dd>
          </div>
          <div>
            <dt>Bank</dt>
            <dd>{profile.bankName}</dd>
          </div>
          <div>
            <dt>Account</dt>
            <dd>{profile.bankAccountNumber}</dd>
          </div>
          <div>
            <dt>PAN</dt>
            <dd>{panOf(profile)}</dd>
          </div>
          <div>
            <dt>PF</dt>
            <dd>{profile.pfAccount}</dd>
          </div>
          <div>
            <dt>Paid days</dt>
            <dd>{paid}</dd>
          </div>
          <div>
            <dt>Loss of pay</dt>
            <dd>0</dd>
          </div>
        </dl>
        <p className="ess-salary-ctc">
          <span className="ess-muted">Annual CTC</span>
          {showAmount(annualCtc)}
        </p>
      </aside>
    </div>
  );
}

function MoneyTable({ title, lines, total }: { title: string; lines: SalaryLine[]; total: number }) {
  const { showAmount } = useEssData();
  return (
    <div className="ess-salary-book">
      <h3>{title}</h3>
      <table className="ess-table">
        <thead>
          <tr>
            <th scope="col">Component</th>
            <th scope="col" className="ess-num">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.label}>
              <td>{line.label}</td>
              <td className="ess-num">{showAmount(line.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Total</th>
            <td className="ess-num">{showAmount(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function YtdStatement({ slips, holidays }: { slips: Payslip[]; holidays: Holiday[] }) {
  const { showAmount } = useEssData();
  const earningLabels = labelsOf(slips, 'earnings');
  const deductionLabels = labelsOf(slips, 'deductions');

  return (
    <div className="ess-table-wrap ess-salary-ytd">
      <table className="ess-table">
        <thead>
          <tr>
            <th scope="col">Item</th>
            {slips.map((slip) => (
              <th key={slip.id} scope="col" className="ess-num">
                {slip.label}
              </th>
            ))}
            <th scope="col" className="ess-num">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="is-group">
            <th scope="colgroup" colSpan={slips.length + 2}>
              Income
            </th>
          </tr>
          {earningLabels.map((label) => (
            <AmountRow key={label} label={label} slips={slips} kind="earnings" />
          ))}
          <tr className="is-total">
            <th scope="row">Gross</th>
            {slips.map((slip) => (
              <td key={slip.id} className="ess-num">
                {showAmount(grossPay(slip))}
              </td>
            ))}
            <td className="ess-num">{showAmount(slips.reduce((sum, slip) => sum + grossPay(slip), 0))}</td>
          </tr>
          <tr className="is-group">
            <th scope="colgroup" colSpan={slips.length + 2}>
              Deduction
            </th>
          </tr>
          {deductionLabels.map((label) => (
            <AmountRow key={label} label={label} slips={slips} kind="deductions" />
          ))}
          <tr className="is-total">
            <th scope="row">Total deductions</th>
            {slips.map((slip) => (
              <td key={slip.id} className="ess-num">
                {showAmount(deductionTotal(slip))}
              </td>
            ))}
            <td className="ess-num">
              {showAmount(slips.reduce((sum, slip) => sum + deductionTotal(slip), 0))}
            </td>
          </tr>
          <tr className="is-total">
            <th scope="row">Net</th>
            {slips.map((slip) => (
              <td key={slip.id} className="ess-num">
                {showAmount(netPay(slip))}
              </td>
            ))}
            <td className="ess-num">{showAmount(slips.reduce((sum, slip) => sum + netPay(slip), 0))}</td>
          </tr>
          <tr className="is-group">
            <th scope="colgroup" colSpan={slips.length + 2}>
              Days
            </th>
          </tr>
          <tr>
            <th scope="row">Paid days</th>
            {slips.map((slip) => (
              <td key={slip.id} className="ess-num">
                {paidDays(slip.month, holidays)}
              </td>
            ))}
            <td className="ess-num">
              {slips.reduce((sum, slip) => sum + paidDays(slip.month, holidays), 0)}
            </td>
          </tr>
          <tr>
            <th scope="row">Loss of pay</th>
            {slips.map((slip) => (
              <td key={slip.id} className="ess-num">
                0
              </td>
            ))}
            <td className="ess-num">0</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function AmountRow({
  label,
  slips,
  kind,
}: {
  label: string;
  slips: Payslip[];
  kind: 'earnings' | 'deductions';
}) {
  const { showAmount } = useEssData();
  const total = slips.reduce((sum, slip) => sum + amountOf(slip, kind, label), 0);
  return (
    <tr>
      <th scope="row">{label}</th>
      {slips.map((slip) => (
        <td key={slip.id} className="ess-num">
          {showAmount(amountOf(slip, kind, label))}
        </td>
      ))}
      <td className="ess-num">{showAmount(total)}</td>
    </tr>
  );
}

function PfStatement({
  slips,
  profile,
  covered,
}: {
  slips: Payslip[];
  profile: EssProfile;
  covered: boolean;
}) {
  const { showAmount } = useEssData();
  return (
    <div className="ess-salary-sheet ess-salary-pf">
      <div className="ess-table-wrap">
        {!covered ? (
          <p className="ess-att-facts">
            <span>
              Provident fund is <strong>not active</strong> on this record. Contribution columns stay blank.
            </span>
          </p>
        ) : null}
        <table className="ess-table">
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col" className="ess-num">
                Earnings
              </th>
              <th scope="col" className="ess-num">
                Employee PF
              </th>
              <th scope="col" className="ess-num">
                Employer PF
              </th>
            </tr>
          </thead>
          <tbody>
            {slips.map((slip) => (
              <tr key={slip.id}>
                <th scope="row">{slip.label}</th>
                <td className="ess-num">{showAmount(grossPay(slip))}</td>
                <td className="ess-num">{covered ? showAmount(0) : '—'}</td>
                <td className="ess-num">{covered ? showAmount(0) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="ess-num">{showAmount(slips.reduce((sum, slip) => sum + grossPay(slip), 0))}</td>
              <td className="ess-num">{covered ? showAmount(0) : '—'}</td>
              <td className="ess-num">{covered ? showAmount(0) : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <aside className="ess-salary-id">
        <h3>Employee details</h3>
        <dl>
          <div>
            <dt>Name</dt>
            <dd>
              {profile.firstName} {profile.lastName}
            </dd>
          </div>
          <div>
            <dt>Employee id</dt>
            <dd>{profile.employeeCode}</dd>
          </div>
          <div>
            <dt>Organization</dt>
            <dd>{ORGANIZATION.name}</dd>
          </div>
          <div>
            <dt>Organization code</dt>
            <dd>{ORGANIZATION.code}</dd>
          </div>
          <div>
            <dt>PF account</dt>
            <dd>{profile.pfAccount}</dd>
          </div>
          <div>
            <dt>PAN</dt>
            <dd>{panOf(profile)}</dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}
