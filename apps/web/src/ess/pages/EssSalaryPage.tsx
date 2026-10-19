import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import {
  downloadMyPayslip,
  fetchMyPayslips,
  type PayslipDto,
} from '../../workspace/payslipApi';

export function EssSalaryPage() {
  const [payslips, setPayslips] = useState<PayslipDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchMyPayslips()
      .then((rows) => {
        setPayslips(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load payslips.'));
  }, []);

  return (
    <div className="ess-section-stack">
      <section className="ess-panel">
        <h2>Payslips</h2>
        <p className="ess-muted">
          PeopleOS stores payslip PDFs uploaded by HR. It is not the payroll engine.
        </p>
        {error ? <p className="ess-alert">{error}</p> : null}
        {message ? <p className="ess-muted">{message}</p> : null}
        {payslips.length === 0 ? (
          <p className="ess-empty">No payslips have been uploaded for you yet.</p>
        ) : (
          <ul className="ess-list">
            {payslips.map((slip) => (
              <li key={slip.id} className="ess-list-item">
                <div className="ess-leave-request-head">
                  <strong>{slip.label}</strong>
                  <span className="ess-muted">{slip.month}</span>
                </div>
                <span className="ess-muted">{slip.fileName}</span>
                <button
                  type="button"
                  className="ess-btn ess-btn-primary"
                  onClick={() => {
                    void downloadMyPayslip(slip.id, slip.fileName)
                      .then(() => setMessage('Download started.'))
                      .catch((err: unknown) =>
                        setError(err instanceof Error ? err.message : 'Download failed.'),
                      );
                  }}
                >
                  <Download size={16} /> Download PDF
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
