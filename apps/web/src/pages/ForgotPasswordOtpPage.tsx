import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  requestPasswordReset,
  verifyPasswordResetOtp,
} from '../lib/api';
import { ForgotPasswordLayout } from './ForgotPasswordLayout';

type LocState = { email?: string };

export function ForgotPasswordOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = (location.state as LocState | null)?.email?.trim().toLowerCase();

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  if (!email) {
    return <Navigate to="/forgot-password" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await verifyPasswordResetOtp(email!, otp);
      navigate('/forgot-password/reset', {
        replace: true,
        state: { resetToken: res.resetToken, email },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (cooldown > 0 || resending) return;
    setError(null);
    setResending(true);
    try {
      await requestPasswordReset(email!);
      setCooldown(60);
      setOtp('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend');
    } finally {
      setResending(false);
    }
  }

  return (
    <ForgotPasswordLayout
      title="Enter OTP"
      subtitle={`We sent a 6-digit code to ${email}. Check Mailpit in local development.`}
    >
      <form className="fp-form" onSubmit={onSubmit} noValidate>
        {error ? (
          <div className="fp-alert" role="alert">
            {error}
          </div>
        ) : null}
        <div className="fp-field">
          <label htmlFor="fp-otp">One-time code</label>
          <input
            id="fp-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={submitting}
            required
          />
        </div>
        <button type="submit" className="fp-submit" disabled={submitting}>
          {submitting ? 'Verifying…' : 'Verify OTP'}
        </button>
        <button
          type="button"
          className="fp-secondary"
          onClick={() => void onResend()}
          disabled={cooldown > 0 || resending}
        >
          {cooldown > 0
            ? `Resend code in ${cooldown}s`
            : resending
              ? 'Sending…'
              : 'Resend OTP'}
        </button>
      </form>
      <p className="fp-links">
        <Link to="/forgot-password">Change email</Link>
        <Link to="/login">Back to sign in</Link>
      </p>
    </ForgotPasswordLayout>
  );
}
