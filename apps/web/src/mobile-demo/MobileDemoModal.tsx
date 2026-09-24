import { useEffect, useId, useRef, type ReactNode } from 'react';
import { MobilePhoneFrame } from './MobilePhoneFrame';
import { MobileDemoApp } from './MobileDemoApp';
import './mobile-demo-modal.css';

export function MobileDemoModal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="mobile-demo-modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="mobile-demo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="mobile-demo-modal-bar">
          <h2 id={titleId} className="mobile-demo-modal-title">
            Mobile preview
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="mobile-demo-modal-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <MobilePhoneFrame>
          {children ?? <MobileDemoApp />}
        </MobilePhoneFrame>
      </div>
    </div>
  );
}
