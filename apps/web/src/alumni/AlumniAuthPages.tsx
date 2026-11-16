import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../theme/ThemeToggle';
import '../pages/LoginPage.css';
import './alumni.css';
import {
  alumniLogin,
  checkInvitation,
  confirmAlumniReset,
  formatDateTime,
  hasAlumniSession,
  registerAlumni,
  requestAlumniReset,
  verifyAlumniReset,
} from './alumniApi';

const PASSWORD_HINT = 'At least 8 characters, with a letter and a number.';

function passwordProblem(value: string) {
  if (!value) return null;
  if (value.length < 8 || !/[A-Za-z]/.test(value) || !/\d/.test(value)) return PASSWORD_HINT;
  return null;
}

function AuthFrame({ sentence, children }: { sentence: string; children: ReactNode }) {
  return (
    <div className="login-page">
      <div className="login-tools">
        <ThemeToggle />
      </div>
      <main className="login-frame">
        <div className="login-grid">
          <header className="login-identity">
            <p className="login-eyebrow">Alumni network</p>
            <h1 className="login-name">PeopleOS Alumni</h1>
            <p className="login-sentence">{sentence}</p>
            <dl className="login-scope">
              <div>
                <dt>Documents</dt>
                <dd>Download your letters, payslips and Form 16.</dd>
              </div>
              <div>
                <dt>Community</dt>
                <dd>Find former colleagues who chose to be listed.</dd>
              </div>
              <div>
                <dt>Careers</dt>
                <dd>See open roles, apply to return, or refer a friend.</dd>
              </div>
            </dl>
            <p className="login-note">
              This login is separate from the employee workspace and only opens the alumni portal.
            </p>
          </header>
          <div className="login-rule" aria-hidden="true" />
          {children}
        </div>
      </main>
    </div>
  );
}

function Field(props: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  error?: string | null;
  disabled?: boolean;
  inputMode?: 'numeric';
}) {
  return (
    <div className="login-field">
      <label className="login-label" htmlFor={props.id}>
        {props.label}
      </label>
      <div className="login-control">
        <input
          id={props.id}
          type={props.type ?? 'text'}
          value={props.value}
          autoComplete={props.autoComplete}
          inputMode={props.inputMode}
          onChange={(event) => props.onChange(event.target.value)}
          aria-invalid={props.error ? true : undefined}
          disabled={props.disabled}
        />
      </div>
      {props.error ? <p className="login-field-error">{props.error}</p> : null}
    </div>
  );
}

export function AlumniLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice ?? null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (hasAlumniSession()) return <Navigate to="/alumni" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await alumniLogin(email.trim(), password);
      navigate('/alumni', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame sentence="Sign in with the personal email you registered with.">
      <form className="login-form" onSubmit={onSubmit} noValidate>
        {notice ? (
          <div className="login-status" role="status">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div className="login-alert" role="alert">
            {error}
          </div>
        ) : null}
        <Field id="al-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" disabled={busy} />
        <Field
          id="al-password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          disabled={busy}
        />
        <p className="login-forgot">
          <Link to="/alumni/forgot-password">Forgot password?</Link>
        </p>
        <button className="login-submit" type="submit" disabled={busy || !email.trim() || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="al-auth-foot">
          New here? Use the invitation link HR emailed you. Employees sign in at <Link to="/login">the workspace</Link>.
        </p>
      </form>
    </AuthFrame>
  );
}

export function AlumniRegisterPage() {
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
  const [invite, setInvite] = useState<{ fullName: string; email: string; expiresAt: string } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(token ? null : 'This page needs the invitation link from your email.');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [data, setData] = useState(false);
  const [communications, setCommunications] = useState(true);
  const [directory, setDirectory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Keep the one-time token out of the address bar and browser history.
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);
    if (!token) return;
    checkInvitation(token)
      .then(setInvite)
      .catch((err: Error) => setLinkError(err.message));
  }, [token]);

  const mismatch = confirm && confirm !== password ? 'The passwords do not match.' : null;
  const canSubmit = invite && !passwordProblem(password) && password && confirm === password && terms && data;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await registerAlumni({ token, password, acceptTerms: terms, acceptDataProcessing: data, communications, directory });
      navigate('/alumni', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame sentence="Create your alumni login. Your email is verified by the link you just opened.">
      <form className="login-form" onSubmit={onSubmit} noValidate>
        {linkError ? (
          <div className="login-alert" role="alert">
            {linkError} <Link to="/alumni/login">Go to sign in</Link>
          </div>
        ) : null}
        {error ? (
          <div className="login-alert" role="alert">
            {error}
          </div>
        ) : null}
        {invite ? (
          <>
            <div className="login-status" role="status">
              Welcome, {invite.fullName}. You will sign in with <strong>{invite.email}</strong>. This link works once and
              expires {formatDateTime(invite.expiresAt)}.
            </div>
            <Field
              id="al-new-password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              error={passwordProblem(password)}
              disabled={busy}
            />
            <Field
              id="al-confirm-password"
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              error={mismatch}
              disabled={busy}
            />
            <fieldset className="al-consent">
              <legend>Consent</legend>
              <label>
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
                <span>
                  I accept the alumni portal terms of use. <em>Required</em>
                </span>
              </label>
              <label>
                <input type="checkbox" checked={data} onChange={(e) => setData(e.target.checked)} />
                <span>
                  I agree that my former employer may keep and use my alumni details for this portal. <em>Required</em>
                </span>
              </label>
              <label>
                <input type="checkbox" checked={communications} onChange={(e) => setCommunications(e.target.checked)} />
                <span>Email me alumni news, events and job openings.</span>
              </label>
              <label>
                <input type="checkbox" checked={directory} onChange={(e) => setDirectory(e.target.checked)} />
                <span>List me in the alumni directory (you choose which details show).</span>
              </label>
              <p>Each choice is saved with the date and time. You can change or withdraw any of them later under Privacy.</p>
            </fieldset>
            <button className="login-submit" type="submit" disabled={busy || !canSubmit}>
              {busy ? 'Creating your login…' : 'Create alumni login'}
            </button>
          </>
        ) : !linkError ? (
          <p className="al-auth-foot">Checking your invitation…</p>
        ) : null}
      </form>
    </AuthFrame>
  );
}

export function AlumniForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === 'email') {
      void run(async () => {
        const result = await requestAlumniReset(email.trim());
        setInfo(result.message);
        setStep('code');
      });
    } else if (step === 'code') {
      void run(async () => {
        const result = await verifyAlumniReset(email.trim(), otp.trim());
        setResetToken(result.resetToken);
        setInfo(null);
        setStep('password');
      });
    } else {
      void run(async () => {
        await confirmAlumniReset(resetToken, password);
        navigate('/alumni/login', { replace: true, state: { notice: 'Password updated. Sign in with your new password.' } });
      });
    }
  }

  return (
    <AuthFrame sentence="Reset your alumni password with a code sent to your login email.">
      <form className="login-form" onSubmit={onSubmit} noValidate>
        {info ? (
          <div className="login-status" role="status">
            {info}
          </div>
        ) : null}
        {error ? (
          <div className="login-alert" role="alert">
            {error}
          </div>
        ) : null}
        {step === 'email' ? (
          <Field id="al-reset-email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="username" disabled={busy} />
        ) : null}
        {step === 'code' ? (
          <Field id="al-reset-code" label="6-digit code" value={otp} onChange={setOtp} inputMode="numeric" disabled={busy} />
        ) : null}
        {step === 'password' ? (
          <Field
            id="al-reset-password"
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            error={passwordProblem(password)}
            disabled={busy}
          />
        ) : null}
        <button
          className="login-submit"
          type="submit"
          disabled={
            busy ||
            (step === 'email' && !email.trim()) ||
            (step === 'code' && !/^\d{6}$/.test(otp.trim())) ||
            (step === 'password' && (!password || Boolean(passwordProblem(password))))
          }
        >
          {step === 'email' ? 'Send code' : step === 'code' ? 'Verify code' : 'Set new password'}
        </button>
        <p className="al-auth-foot">
          <Link to="/alumni/login">Back to sign in</Link>
        </p>
      </form>
    </AuthFrame>
  );
}
