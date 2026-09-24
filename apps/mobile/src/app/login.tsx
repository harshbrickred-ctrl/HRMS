import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fonts, Spacing, brand, useThemeColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

export default function LoginScreen() {
  const { user, loading, login } = useAuth();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [email, setEmail] = useState('employee@peopleos.local');
  const [password, setPassword] = useState('ChangeMe123!');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!loading && user) return <Redirect href="/(tabs)" />;

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
      >
        <View style={styles.brandBlock}>
          <Text
            style={[
              styles.brand,
              { color: colors.text, fontFamily: Fonts?.display },
            ]}
          >
            PeopleOS
          </Text>
          <Text
            style={[
              styles.headline,
              { color: colors.text, fontFamily: Fonts?.display },
            ]}
          >
            Workday rhythm,{'\n'}
            <Text style={{ color: colors.textSecondary }}>one calm place.</Text>
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Sign in to leave, attendance, and team workflows.
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.cardElevated,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.panelTitle, { color: colors.text, fontFamily: Fonts?.display }]}>
            Sign in
          </Text>
          <Text style={{ color: colors.textSecondary, marginBottom: 4 }}>
            Use your work email and password.
          </Text>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
          />
          <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
          <TextInput
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={onSubmit}
            disabled={submitting}
            style={[styles.button, { opacity: submitting ? 0.7 : 1 }]}
          >
            {submitting ? (
              <ActivityIndicator color={brand.primaryInk} />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
        </View>

        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Seed password: ChangeMe123!
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  wrap: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  brandBlock: { gap: Spacing.sm },
  brand: { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  headline: { fontSize: 26, fontWeight: '700', letterSpacing: -0.6, lineHeight: 30 },
  subtitle: { fontSize: 15 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  panelTitle: { fontSize: 20, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    marginTop: Spacing.sm,
    backgroundColor: brand.primary,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: brand.primaryInk,
    fontWeight: '700',
    fontSize: 16,
  },
  error: { color: brand.danger, fontSize: 14 },
  hint: { textAlign: 'center', fontSize: 13 },
});
