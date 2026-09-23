import { useEffect } from 'react';
import { useEssData } from '../mock/EssDataContext';

export function EssToast() {
  const { toast, clearToast } = useEssData();

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => clearToast(), 3200);
    return () => window.clearTimeout(t);
  }, [toast, clearToast]);

  if (!toast) return null;

  return (
    <div className="ess-toast" role="status" aria-live="polite">
      <span>{toast}</span>
      <button type="button" onClick={clearToast}>
        Dismiss
      </button>
    </div>
  );
}
