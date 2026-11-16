import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fonts, Spacing, brand, useThemeColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { clearResetDone, peekResetDone } from '@/lib/passwordReset';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function emailError(value: string) {
  const email = value.trim();
  if (!email) return null;
  if (!EMAIL_PATTERN.test(email)) return 'Email is invalid';
  return null;
}

function passwordError(value: string) {
  if (!value) return null;
  if (!value.trim() || value.trim().length < 8) return 'Password is invalid';
  return null;
}

export default function LoginScreen() {
  const { user, loading, login } = useAuth();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetNote, setResetNote] = useState(peekResetDone);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const emailMessage = emailError(email);
  const passwordMessage = passwordError(password);
  const canSubmit =
    email.trim().length > 0 &&
    password.trim().length > 0 &&
    !emailMessage &&
    !passwordMessage &&
    !submitting;

  if (!loading && user) return <Redirect href="/(tabs)" />;

  async function onSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      clearResetDone();
      setResetNote(false);
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
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.wrap,
            keyboardHeight > 0 && {
              justifyContent: 'flex-start',
              paddingBottom: keyboardHeight,
            },
          ]}
          showsVerticalScrollIndicator={false}
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
            autoComplete="email"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setError(null);
            }}
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: emailMessage ? brand.danger : colors.border,
                backgroundColor: colors.card,
              },
            ]}
          />
          {emailMessage ? <Text style={styles.error}>{emailMessage}</Text> : null}
          <Text style={[styles.label, { color: colors.textSecondary }]}>Password</Text>
          <View
            style={[
              styles.passwordRow,
              {
                borderColor: passwordMessage ? brand.danger : colors.border,
                backgroundColor: colors.card,
              },
            ]}
          >
            <TextInput
              autoComplete="password"
              secureTextEntry={!showPassword}
              textContentType="password"
              value={password}
              onFocus={() => {
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
              }}
              onChangeText={(value) => {
                setPassword(value);
                setError(null);
              }}
              style={[styles.passwordInput, { color: colors.text }]}
            />
            <Pressable
              onPress={() => setShowPassword((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={8}
              style={styles.eyeButton}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>
          {passwordMessage ? <Text style={styles.error}>{passwordMessage}</Text> : null}
          {resetNote ? (
            <Text style={{ color: colors.text }}>Password updated. Sign in with the new password.</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            accessibilityState={{ disabled: !canSubmit }}
            style={[styles.button, { opacity: canSubmit ? 1 : 0.45 }]}
          >
            {submitting ? (
              <ActivityIndicator color={brand.primaryInk} />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
          <Pressable onPress={() => router.push('/forgot-password')}>
            <Text style={{ color: colors.text, fontWeight: '700', textAlign: 'center' }}>
              Forgot password
            </Text>
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  wrap: {
    flexGrow: 1,
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
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
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
});
