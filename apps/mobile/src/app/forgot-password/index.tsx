import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, useColorScheme } from 'react-native';
import { Card, Field, PrimaryButton, Screen } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { requestPasswordReset } from '@/lib/api';
import { setForgotEmail } from '@/lib/passwordReset';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function emailError(value: string) {
  const email = value.trim();
  if (!email) return null;
  if (!EMAIL_PATTERN.test(email)) return 'Email is invalid';
  return null;
}

export default function ForgotPasswordRequest() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailMessage = emailError(email);
  const canSubmit = email.trim().length > 0 && !emailMessage && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    const trimmed = email.trim().toLowerCase();
    setSubmitting(true);
    try {
      await requestPasswordReset(trimmed);
      setForgotEmail(trimmed);
      router.push('/forgot-password/otp');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send OTP';
      if (message.toLowerCase().includes('not registered')) setPopup(message);
      else setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title="Forgot password" back>
      <Text style={{ color: colors.textSecondary }}>
        Enter your registered work email. If an account exists, we will send a one-time code.
      </Text>
      <Card>
        {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
        <Field
          label="Work email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
            setPopup(null);
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={!submitting}
          style={emailMessage ? { borderColor: brand.danger } : undefined}
        />
        {emailMessage ? <Text style={{ color: brand.danger }}>{emailMessage}</Text> : null}
        <PrimaryButton
          label={submitting ? 'Sending…' : 'Send OTP'}
          onPress={() => void onSubmit()}
          disabled={!canSubmit}
        />
      </Card>
      <Pressable onPress={() => router.replace('/login')}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Back to sign in</Text>
      </Pressable>
      <Modal visible={popup !== null} transparent animationType="fade" onRequestClose={() => setPopup(null)}>
        <Pressable
          onPress={() => setPopup(null)}
          style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.4)' }}
        >
          <Pressable
            onPress={() => undefined}
            style={{ backgroundColor: colors.card, borderRadius: 16, padding: 20, gap: 12 }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>Email not registered</Text>
            <Text style={{ color: brand.danger, fontSize: 15, lineHeight: 22 }}>{popup}</Text>
            <PrimaryButton label="OK" onPress={() => setPopup(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
