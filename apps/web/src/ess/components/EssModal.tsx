import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
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
    </div>,
    document.body,
  );
}
