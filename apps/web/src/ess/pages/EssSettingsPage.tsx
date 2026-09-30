import { useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { changePassword } from '../../lib/api';
import { preferenceLabel, type ThemePreference } from '../../theme/theme';
import { useTheme } from '../../theme/ThemeContext';

const THEMES: ThemePreference[] = ['light', 'dark', 'system'];

export function EssSettingsPage() {
  const { user } = useAuth();
  const { preference, setPreference } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from the current password.');
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ess-section-stack">
      <p className="ess-lead">
        Signed in as {user?.email}. Appearance stays on this device. Password
        updates your PeopleOS account.
      </p>

      <section className="ess-panel">
        <h2>Appearance</h2>
        <div className="ess-tabs" role="radiogroup" aria-label="Appearance">
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={preference === theme}
              className={preference === theme ? 'ess-tab is-active' : 'ess-tab'}
              onClick={() => setPreference(theme)}
            >
              {preferenceLabel(theme)}
            </button>
          ))}
        </div>
      </section>

      <section className="ess-panel">
        <h2>Password</h2>
        <form className="ess-form" onSubmit={onSubmit}>
          <div className="ess-field">
            <label htmlFor="settings-current-password">Current password</label>
            <input
              id="settings-current-password"
              type="password"
              name="current-password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>
          <div className="ess-field">
            <label htmlFor="settings-new-password">New password</label>
            <input
              id="settings-new-password"
              type="password"
              name="new-password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          <div className="ess-field">
            <label htmlFor="settings-confirm-password">Confirm new password</label>
            <input
              id="settings-confirm-password"
              type="password"
              name="confirm-password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              required
            />
          </div>
          {error ? <p className="ess-field-error">{error}</p> : null}
          {saved ? (
            <p className="ess-muted" role="status">
              Password updated. Other signed-in devices will need to sign in again.
            </p>
          ) : null}
          <button type="submit" className="ess-btn ess-btn-primary" disabled={submitting}>
            {submitting ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </section>
    </div>
  );
}
