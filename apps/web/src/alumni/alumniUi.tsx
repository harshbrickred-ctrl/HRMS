import { useEffect, useState } from 'react';
import { StatusChip } from '../ess/components/StatusChip';
import { alumniPhotoUrl, chipFor, formatDateTime, statusLabel, type HistoryStep } from './alumniApi';

export function Chip({ status, label }: { status: string; label?: string }) {
  return <StatusChip status={chipFor(status)} label={label ?? statusLabel(status)} />;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

/** Loads the photo with the login token (img tags cannot send it). */
export function Avatar({ id, name, hasPhoto, large, version = 0 }: { id: string; name: string; hasPhoto?: boolean; large?: boolean; version?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!hasPhoto) {
      setUrl(null);
      return;
    }
    let alive = true;
    let made: string | null = null;
    alumniPhotoUrl(id)
      .then((objectUrl) => {
        made = objectUrl;
        if (alive) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id, hasPhoto, version]);
  const className = `al-avatar${large ? ' al-avatar-lg' : ''}`;
  return url ? <img className={className} src={url} alt={`${name}`} /> : <span className={className} aria-hidden="true">{initials(name)}</span>;
}

export function Steps({ history }: { history: HistoryStep[] }) {
  if (!history.length) return null;
  return (
    <ol className="al-steps">
      {history.map((step, index) => (
        <li key={`${step.toStatus}-${index}`}>
          {statusLabel(step.toStatus)} · {formatDateTime(step.at)}
          {step.note ? ` · ${step.note}` : ''}
        </li>
      ))}
    </ol>
  );
}
