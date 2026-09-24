import { useState } from 'react';
import type { FormEvent } from 'react';
import { Smartphone } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { MobileDemoModal } from '../mobile-demo/MobileDemoModal';
import { ThemeToggle } from '../theme/ThemeToggle';
import './LoginPage.css';

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetSuccess = searchParams.get('reset') === '1';
  const [email, setEmail] = useState('admin@peopleos.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!loading && user) {
    return <Navigate to="/ess" replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/ess', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-theme">
        <button
          type="button"
          className="login-mobile-btn"
          aria-label="Preview mobile app"
          title="Preview mobile app"
          onClick={() => setMobileOpen(true)}
        >
          <Smartphone size={18} strokeWidth={2} aria-hidden />
        </button>
        <ThemeToggle />
      </div>

      <MobileDemoModal open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="login-glow login-glow--lime" aria-hidden="true" />
      <div className="login-glow login-glow--slate" aria-hidden="true" />

      <div className="login-stage" role="main">
        <section className="login-brand">
          <p className="login-mark">PeopleOS</p>
          <h1 className="login-headline">
            Workday rhythm,
            <span> one calm place.</span>
          </h1>
          <p className="login-lede">
            Sign in to leave, attendance, and team workflows for your
            organization.
          </p>
        </section>

        <section className="login-panel">
          <header className="login-panel-head">
            <h2>Sign in</h2>
            <p>Use your work email and password.</p>
          </header>

          {resetSuccess ? (
            <div className="login-success" role="status">
              Password updated. Sign in with your new password.
            </div>
          ) : null}

          <form className="login-form" onSubmit={onSubmit} noValidate>
            {error ? (
              <div className="login-alert" role="alert">
                {error}
              </div>
            ) : null}

            <label className="field" htmlFor="login-email">
              <span>Email</span>
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting || loading}
              />
            </label>

            <div className="field">
              <label htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={submitting || loading}
              />
              <p className="login-forgot">
                <Link to="/forgot-password">Forgot password?</Link>
              </p>
            </div>

            <button type="submit" disabled={submitting || loading}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
