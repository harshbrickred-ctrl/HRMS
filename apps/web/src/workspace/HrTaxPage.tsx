import { useEffect, useState } from 'react';
import { StatusChip } from '../ess/components/StatusChip';
import { showToast } from '../ui/toast';
import { formatSalary } from './salaryApi';
import {
  decideInvestmentProof,
  decideTaxDeclaration,
  decideTaxRegimeChange,
  fetchTaxCompanyQueue,
  openInvestmentProof,
  type TaxCompanyQueue,
} from './taxApi';

export function HrTaxPage() {
  const [queue, setQueue] = useState<TaxCompanyQueue | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () =>
    fetchTaxCompanyQueue()
      .then((data) => {
        setQueue(data);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load tax queue.'));

  useEffect(() => {
    void load();
  }, []);

  const pending =
    (queue?.declarations.length ?? 0) + (queue?.proofs.length ?? 0) + (queue?.regimeChanges.length ?? 0);

  return (
    <div className="ess-section-stack">
      <section className="ess-panel">
        <h2>Tax reviews</h2>
        <p className="ess-muted">
          Approve declarations (syncs 80C / HRA rent into salary structure), accept proofs, and decide regime changes.
        </p>
        <p>
          <strong>{pending}</strong> pending item{pending === 1 ? '' : 's'}
        </p>
        {error ? <p className="ess-alert">{error}</p> : null}
      </section>

      <section className="ess-panel">
        <h2>Declarations</h2>
        {!(queue?.declarations.length) ? <p className="ess-empty">No submitted declarations.</p> : null}
        <ul className="ess-list">
          {(queue?.declarations ?? []).map((item) => (
            <li key={item.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>
                  {item.employeeName} · FY {item.fy}
                </strong>
                <StatusChip status={item.status} />
              </div>
              <span className="ess-muted">
                Chapter VI-A {formatSalary(item.chapter6Total ?? 0)} · Rent {formatSalary(item.rentPaidAnnual)}
                {item.isMetro ? ' · Metro' : ''}
              </span>
              <ul className="ess-muted">
                {item.lines.map((line) => (
                  <li key={`${line.section}-${line.label}`}>
                    {line.section} {line.label}: {formatSalary(line.amount)}
                  </li>
                ))}
              </ul>
              <div className="ess-actions">
                <button
                  type="button"
                  className="ess-btn ess-btn-primary"
                  disabled={busyId === item.id}
                  onClick={() => {
                    if (!item.id) return;
                    setBusyId(item.id);
                    void decideTaxDeclaration(item.id, 'approved')
                      .then(() => {
                        showToast('Declaration approved.');
                        return load();
                      })
                      .catch((err: unknown) =>
                        setError(err instanceof Error ? err.message : 'Could not approve.'),
                      )
                      .finally(() => setBusyId(null));
                  }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="ess-btn"
                  disabled={busyId === item.id}
                  onClick={() => {
                    if (!item.id) return;
                    setBusyId(item.id);
                    void decideTaxDeclaration(item.id, 'rejected')
                      .then(() => {
                        showToast('Declaration rejected.');
                        return load();
                      })
                      .catch((err: unknown) =>
                        setError(err instanceof Error ? err.message : 'Could not reject.'),
                      )
                      .finally(() => setBusyId(null));
                  }}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="ess-panel">
        <h2>Investment proofs</h2>
        {!(queue?.proofs.length) ? <p className="ess-empty">No pending proofs.</p> : null}
        <ul className="ess-list">
          {(queue?.proofs ?? []).map((proof) => (
            <li key={proof.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>
                  {proof.employeeName} · {proof.section} · {proof.label}
                </strong>
                <StatusChip status={proof.status} />
              </div>
              <span>
                {formatSalary(proof.amount)} · {proof.fileName}
              </span>
              <div className="ess-actions">
                <button
                  type="button"
                  className="ess-btn ess-btn-ghost"
                  onClick={() => void openInvestmentProof(proof.id, proof.fileName, true)}
                >
                  Open file
                </button>
                <button
                  type="button"
                  className="ess-btn ess-btn-primary"
                  disabled={busyId === proof.id}
                  onClick={() => {
                    setBusyId(proof.id);
                    void decideInvestmentProof(proof.id, 'accepted')
                      .then(() => {
                        showToast('Proof accepted.');
                        return load();
                      })
                      .catch((err: unknown) =>
                        setError(err instanceof Error ? err.message : 'Could not accept.'),
                      )
                      .finally(() => setBusyId(null));
                  }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="ess-btn"
                  disabled={busyId === proof.id}
                  onClick={() => {
                    setBusyId(proof.id);
                    void decideInvestmentProof(proof.id, 'rejected')
                      .then(() => {
                        showToast('Proof rejected.');
                        return load();
                      })
                      .catch((err: unknown) =>
                        setError(err instanceof Error ? err.message : 'Could not reject.'),
                      )
                      .finally(() => setBusyId(null));
                  }}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="ess-panel">
        <h2>Regime change requests</h2>
        {!(queue?.regimeChanges.length) ? <p className="ess-empty">No pending regime changes.</p> : null}
        <ul className="ess-list">
          {(queue?.regimeChanges ?? []).map((item) => (
            <li key={item.id} className="ess-list-item">
              <div className="ess-leave-request-head">
                <strong>
                  {item.employeeName} · {item.fromRegime} → {item.toRegime}
                </strong>
                <StatusChip status={item.status} />
              </div>
              {item.reason ? <p className="ess-muted">{item.reason}</p> : null}
              <div className="ess-actions">
                <button
                  type="button"
                  className="ess-btn ess-btn-primary"
                  disabled={busyId === item.id}
                  onClick={() => {
                    setBusyId(item.id);
                    void decideTaxRegimeChange(item.id, 'approved')
                      .then(() => {
                        showToast('Regime change approved.');
                        return load();
                      })
                      .catch((err: unknown) =>
                        setError(err instanceof Error ? err.message : 'Could not approve.'),
                      )
                      .finally(() => setBusyId(null));
                  }}
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="ess-btn"
                  disabled={busyId === item.id}
                  onClick={() => {
                    setBusyId(item.id);
                    void decideTaxRegimeChange(item.id, 'rejected')
                      .then(() => {
                        showToast('Regime change rejected.');
                        return load();
                      })
                      .catch((err: unknown) =>
                        setError(err instanceof Error ? err.message : 'Could not reject.'),
                      )
                      .finally(() => setBusyId(null));
                  }}
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
