import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestPasswordReset } from '../lib/api';
import { ForgotPasswordLayout } from './ForgotPasswordLayout';

export function ForgotPasswordRequestPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Work email is required.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await requestPasswordReset(trimmed);
      setInfo(res.message);
      navigate('/forgot-password/otp', {
        replace: false,
        state: { email: trimmed },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send OTP');
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
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
          />
        </div>
        <button type="submit" className="fp-submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send OTP'}
        </button>
      </form>
      <p className="fp-links">
        <Link to="/login">Back to sign in</Link>
      </p>
    </ForgotPasswordLayout>
  );
}
