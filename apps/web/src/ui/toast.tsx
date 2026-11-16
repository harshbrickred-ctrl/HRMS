import { useEffect, useState } from 'react';
import './toast.css';

export type ToastTone = 'ok' | 'danger';

type ToastPayload = { message: string; tone: ToastTone };

type Listener = (toast: ToastPayload | null) => void;

const listeners = new Set<Listener>();

export function showToast(message: string, tone: ToastTone = 'ok') {
  listeners.forEach((listener) => listener({ message, tone }));
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  useEffect(() => {
    listeners.add(setToast);
    return () => {
      listeners.delete(setToast);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  return (
    <div className={`app-toast${toast.tone === 'danger' ? ' is-danger' : ''}`} role="status" aria-live="polite">
      <span>{toast.message}</span>
      <button type="button" onClick={() => setToast(null)}>
        Dismiss
      </button>
    </div>
  );
}
