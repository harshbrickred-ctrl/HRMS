import { useState, type FormEvent } from 'react';

export function RejectLeaveButton({
  busy,
  onReject,
}: {
  busy?: boolean;
  onReject: (note: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    const comment = note.trim();
    if (!comment) return;
    onReject(comment);
  }

  if (!open) {
    return (
      <button type="button" className="ess-btn ess-btn-danger" disabled={busy} onClick={() => setOpen(true)}>
        Reject
      </button>
    );
  }

  return (
    <form className="ess-reject-box" onSubmit={submit}>
      <label>
        <span className="ess-muted">Rejection comment</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Why is this leave rejected?"
          rows={2}
          required
        />
      </label>
      <div className="ess-actions">
        <button type="submit" className="ess-btn ess-btn-danger" disabled={busy || !note.trim()}>
          {busy ? 'Rejecting…' : 'Reject'}
        </button>
        <button
          type="button"
          className="ess-btn"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setNote('');
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
