import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, useColorScheme } from 'react-native';
import { Card, Field, PrimaryButton, Screen } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { requestPasswordReset, verifyPasswordResetOtp } from '@/lib/api';
import { getForgotEmail, setResetToken } from '@/lib/passwordReset';

export default function ForgotPasswordOtp() {
  const email = getForgotEmail();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!email) return <Redirect href="/forgot-password" />;

  async function onSubmit() {
    setError(null);
    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await verifyPasswordResetOtp(email!, otp);
      setResetToken(res.resetToken);
      router.replace('/forgot-password/reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (cooldown > 0 || resending || !email) return;
    setError(null);
    setResending(true);
    try {
      await requestPasswordReset(email);
      setCooldown(60);
      setOtp('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend');
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen title="Enter OTP" back>
      <Text style={{ color: colors.textSecondary }}>
        We sent a 6-digit code to {email}. Check Mailpit in local development.
      </Text>
      <Card>
        {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
        <Field
          label="One-time code"
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
        />
        <PrimaryButton
          label={submitting ? 'Checking…' : 'Verify'}
          onPress={() => void onSubmit()}
          disabled={submitting}
        />
        <Pressable onPress={() => void onResend()} disabled={cooldown > 0 || resending}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </Text>
        </Pressable>
      </Card>
    </Screen>
  );
}
