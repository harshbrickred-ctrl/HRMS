import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import './UserMenu.css';

type UserMenuProps = {
  email: string;
  roles: string[];
  onSignOut: () => void;
};

function initialsFromEmail(email: string) {
  const local = email.split('@')[0] || '?';
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function UserMenu({ email, roles, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="user-menu-avatar" aria-hidden>
          {initialsFromEmail(email)}
        </span>
        <span className="user-menu-email">{email || 'Account'}</span>
        <ChevronDown size={16} aria-hidden className="user-menu-chevron" />
      </button>

      {open ? (
        <div
          id={menuId}
          className="user-menu-panel"
          role="menu"
          aria-label="Account"
        >
          <div className="user-menu-meta">
            <p className="user-menu-meta-email">{email}</p>
            <p className="user-menu-meta-roles">
              {roles.length ? roles.join(' · ') : '—'}
            </p>
          </div>
          <button
            type="button"
            className="user-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            <LogOut size={16} aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
