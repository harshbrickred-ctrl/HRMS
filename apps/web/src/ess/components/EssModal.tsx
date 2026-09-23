import { useEffect, useRef, type ReactNode } from 'react';

type EssModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
};

export function EssModal({ title, children, onClose, actions }: EssModalProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="ess-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="ess-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ess-modal-title"
      >
        <h2 id="ess-modal-title">{title}</h2>
        {children}
        <div className="ess-modal-actions">
          {actions ?? (
            <button
              ref={closeRef}
              type="button"
              className="ess-btn"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
