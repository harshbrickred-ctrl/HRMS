import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { confirmPasswordReset } from '../lib/api';
import { ForgotPasswordLayout } from './ForgotPasswordLayout';

type LocState = { resetToken?: string; email?: string };

export function ForgotPasswordResetPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocState | null) ?? {};
  const resetToken = state.resetToken;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!resetToken) {
    return <Navigate to="/forgot-password" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(resetToken!, password);
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ForgotPasswordLayout
      title="Create new password"
      subtitle="Choose a new password for your PeopleOS account."
    >
      <form className="fp-form" onSubmit={onSubmit} noValidate>
        {error ? (
          <div className="fp-alert" role="alert">
            {error}
          </div>
        ) : null}
        <div className="fp-field">
          <label htmlFor="fp-password">New password</label>
          <input
            id="fp-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            disabled={submitting}
            required
          />
        </div>
        <div className="fp-field">
          <label htmlFor="fp-confirm">Confirm password</label>
          <input
            id="fp-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            disabled={submitting}
            required
          />
        </div>
        <button type="submit" className="fp-submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Create password'}
        </button>
      </form>
      <p className="fp-links">
        <Link to="/login">Back to sign in</Link>
      </p>
    </ForgotPasswordLayout>
  );
}
