import { useState } from 'react';
import { Appearance, Text, useColorScheme } from 'react-native';
import { Card, Field, PrimaryButton, Screen, Segmented } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { changePassword } from '@/lib/api';
import { showToast } from '@/lib/toast';

const THEMES = ['light', 'dark', 'system'] as const;

export default function SettingsScreen() {
  const { user } = useAuth();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [preference, setPreferenceState] = useState<(typeof THEMES)[number]>('system');

  function setPreference(next: (typeof THEMES)[number]) {
    setPreferenceState(next);
    Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
  }
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
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
      showToast('Password updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Settings" back>
      <Text style={{ color: colors.textSecondary }}>
        Signed in as {user?.email}. Password updates your PeopleOS account.
      </Text>
      <Card>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Appearance</Text>
        <Text style={{ color: colors.textSecondary }}>
          This device follows {scheme === 'dark' ? 'dark' : 'light'} right now. Preference: {preference}.
        </Text>
        <Segmented value={preference} options={THEMES.map((theme) => [theme, theme])} onChange={setPreference} />
      </Card>
      <Card>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Password</Text>
        <Field
          label="Current password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <Field label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
        <Field
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
        {saved ? (
          <Text style={{ color: colors.textSecondary }}>
            Password updated. Other signed-in devices will need to sign in again.
          </Text>
        ) : null}
        <PrimaryButton
          label={submitting ? 'Saving…' : 'Update password'}
          onPress={() => void onSubmit()}
          disabled={submitting}
        />
      </Card>
    </Screen>
  );
}
