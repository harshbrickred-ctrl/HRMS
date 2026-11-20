import { Fragment } from 'react';
import { formatSalary, type TaxBreakdown } from './salaryApi';
import './salary.css';

const SECTION_LABEL: Record<TaxBreakdown['rows'][number]['section'], string> = {
  income: 'Income',
  deduction: 'Deductions',
  slab: 'Slab-wise tax',
  liability: 'Tax liability',
  tds: 'TDS',
};

export function TaxSheet({
  breakdown,
  title = 'Tax computation',
  note,
}: {
  breakdown: TaxBreakdown;
  title?: string;
  note?: string;
}) {
  const regimeLabel = breakdown.regime === 'old' ? 'Old' : 'New';
  let lastSection = '';

  return (
    <section className="salary-sheet tax-sheet">
      <h2>{title}</h2>
      <p className="salary-note">
        {note ??
          `${regimeLabel} tax regime · amounts, slab rates, and formulas used for this employee.`}
      </p>
      <div className="salary-scroll">
        <table className="salary-table tax-table">
          <caption>Tax breakdown ({regimeLabel} regime)</caption>
          <thead>
            <tr>
              <th>Ref</th>
              <th>Particulars</th>
              <th>Rate</th>
              <th>Amount</th>
              <th>Formula</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.rows.map((row) => {
              const showSection = row.section !== lastSection;
              lastSection = row.section;
              return (
                <Fragment key={row.id}>
                  {showSection ? (
                    <tr className="tax-section-row">
                      <td colSpan={5}>{SECTION_LABEL[row.section]}</td>
                    </tr>
                  ) : null}
                  <tr className={row.id === 'TX-11' ? 'tax-total-row' : undefined}>
                    <td>{row.id}</td>
                    <td>{row.label}</td>
                    <td className="tax-rate">{row.rate}</td>
                    <td>{formatSalary(row.amount)}</td>
                    <td className="tax-formula">{row.formula}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
