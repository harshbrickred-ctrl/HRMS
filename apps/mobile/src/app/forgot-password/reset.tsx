import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Text, useColorScheme } from 'react-native';
import { Card, Field, PrimaryButton, Screen } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { confirmPasswordReset } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { getResetToken, markResetDone } from '@/lib/passwordReset';

export default function ForgotPasswordReset() {
  const resetToken = getResetToken();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!resetToken) return <Redirect href="/forgot-password" />;

  async function onSubmit() {
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
      showToast('Password updated. Sign in with the new password.');
      markResetDone();
      router.replace('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title="New password" back>
      <Text style={{ color: colors.textSecondary }}>
        Choose a new password for your PeopleOS account.
      </Text>
      <Card>
        {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
        <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
        <Field label="Confirm password" value={confirm} onChangeText={setConfirm} secureTextEntry />
        <PrimaryButton
          label={submitting ? 'Saving…' : 'Update password'}
          onPress={() => void onSubmit()}
          disabled={submitting}
        />
      </Card>
    </Screen>
  );
}
