import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestPasswordReset } from '../lib/api';
import { ForgotPasswordLayout } from './ForgotPasswordLayout';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function emailError(value: string) {
  const email = value.trim();
  if (!email) return null;
  if (!EMAIL_PATTERN.test(email)) return 'Email is invalid';
  return null;
}

export function ForgotPasswordRequestPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailMessage = emailError(email);
  const canSubmit = email.trim().length > 0 && !emailMessage && !submitting;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setInfo(null);
    const trimmed = email.trim().toLowerCase();
    setSubmitting(true);
    try {
      const res = await requestPasswordReset(trimmed);
      setInfo(res.message);
      navigate('/forgot-password/otp', {
        replace: false,
        state: { email: trimmed },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send OTP';
      if (message.toLowerCase().includes('not registered')) setPopup(message);
      else setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ForgotPasswordLayout
      title="Forgot password"
      subtitle="Enter your registered work email. If an account exists, we will send a one-time code."
    >
      <form className="fp-form" onSubmit={onSubmit} noValidate>
        {error ? (
          <div className="fp-alert" role="alert">
            {error}
          </div>
        ) : null}
        {info ? <div className="fp-ok">{info}</div> : null}
        <div className="fp-field">
          <label htmlFor="fp-email">Work email</label>
          <input
            id="fp-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
              setPopup(null);
            }}
            aria-invalid={emailMessage ? true : undefined}
            aria-describedby={emailMessage ? 'fp-email-error' : undefined}
            disabled={submitting}
          />
          {emailMessage ? (
            <p id="fp-email-error" className="fp-field-error">
              {emailMessage}
            </p>
          ) : null}
        </div>
        <button type="submit" className="fp-submit" disabled={!canSubmit}>
          {submitting ? 'Sending…' : 'Send OTP'}
        </button>
      </form>
      <p className="fp-links">
        <Link to="/login">Back to sign in</Link>
      </p>
      {popup ? (
        <div
          className="fp-popup-backdrop"
          role="presentation"
          onClick={() => setPopup(null)}
        >
          <div
            className="fp-popup"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="fp-popup-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="fp-popup-title">Email not registered</h2>
            <p>{popup}</p>
            <button type="button" className="fp-submit" onClick={() => setPopup(null)}>
              OK
            </button>
          </div>
        </div>
      ) : null}
    </ForgotPasswordLayout>
  );
}
