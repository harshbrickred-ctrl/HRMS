import { useEffect, useState } from 'react';
import { StatusChip } from '../ess/components/StatusChip';
import { showToast } from '../ui/toast';
import { decideLeaveRequest, fetchCompanyLeave, leaveDecisionToast, type LeaveRequestDto } from './leaveApi';
import { RejectLeaveButton } from './RejectLeaveButton';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Could not update that leave.';
}

export function LeaveApprovalsPanel() {
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    fetchCompanyLeave()
      .then((data) => {
        setRequests(data.requests);
        setError(null);
      })
      .catch((err: unknown) => setError(messageOf(err)));
  }

  useEffect(() => {
    load();
  }, []);

  async function onDecide(id: string, status: 'Approved' | 'Rejected', note?: string) {
    setBusyId(id);
    setError(null);
    try {
      const saved = await decideLeaveRequest(id, status, note);
      load();
      const toast = leaveDecisionToast(saved.status === 'Rejected' || status === 'Rejected' ? 'Rejected' : saved.status);
      showToast(toast.message, toast.tone);
    } catch (err: unknown) {
      setError(messageOf(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="ess-panel">
      <h2>Leave requests</h2>
      <p className="ess-muted">Approve or reject leave applied by anyone in the company.</p>
      {error ? <p className="ess-alert">{error}</p> : null}
      {requests.length === 0 ? <p className="ess-empty">No leave is waiting.</p> : null}
      <ul className="ess-list">
        {requests.map((item) => (
          <li key={item.id} className="ess-list-item">
            <div className="ess-leave-request-head">
              <strong>{item.person?.name ?? 'Employee'} · {item.type}</strong>
              <StatusChip status={item.status} />
            </div>
            <span className="ess-muted">
              {item.startDate}
              {item.endDate !== item.startDate ? ` – ${item.endDate}` : ''} · {item.days} day(s)
              {item.reason ? ` · ${item.reason}` : ''}
            </span>
            <div className="ess-actions">
              <button
                type="button"
                className="ess-btn ess-btn-primary"
                disabled={busyId === item.id}
                onClick={() => void onDecide(item.id, 'Approved')}
              >
                Approve
              </button>
              <RejectLeaveButton
                busy={busyId === item.id}
                onReject={(note) => void onDecide(item.id, 'Rejected', note)}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AdminLeavePage() {
  return (
    <div className="ess-section-stack">
      <LeaveApprovalsPanel />
    </div>
  );
}
