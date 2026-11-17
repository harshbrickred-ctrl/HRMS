import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useFocusEffect } from 'expo-router';
import { createElement, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Fonts, Spacing, brand, useThemeColors } from '@/constants/theme';
import { pickLocalFile } from '@/lib/files';
import { subscribeToast } from '@/lib/toast';
import { useEssData } from '@/mock/EssDataContext';

export function Screen({
  title,
  children,
  scroll = true,
  back = false,
}: {
  title?: string;
  children: ReactNode;
  scroll?: boolean;
  back?: boolean;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const scrollRef = useRef<ScrollView>(null);
  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, []),
  );
  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.scroll, { flex: 1 }]}>{children}</View>
  );

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={back ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}
    >
      {title ? (
        <View
          style={[
            styles.header,
            { borderBottomColor: colors.border, backgroundColor: colors.cardElevated },
          ]}
        >
          {back ? (
            <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
              <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.backSpacer} />
          )}
          <Text
            style={[styles.title, { color: colors.text, fontFamily: Fonts?.display }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          <View style={styles.backSpacer} />
        </View>
      ) : null}
      {body}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Meta({ label, value }: { label: string; value: string }) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  return (
    <View style={styles.meta}>
      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.text }]}>{value || '—'}</Text>
    </View>
  );
}

export function Insights({ items }: { items: Array<[string, string | number]> }) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  return (
    <View style={styles.insights}>
      {items.map(([label, value]) => (
        <Card key={label} style={styles.insight}>
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{label}</Text>
          <Text style={[styles.insightValue, { color: colors.text }]} numberOfLines={2}>
            {value}
          </Text>
        </Card>
      ))}
    </View>
  );
}

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const key = status.toLowerCase();
  let bg: string = colors.border;
  let fg: string = colors.text;
  if (key.includes('approv') || key === 'present' || key === 'ok' || key === 'delivered' || key === 'resolved') {
    bg = '#e4f0c8';
    fg = brand.success;
  } else if (key.includes('reject') || key === 'absent' || key === 'bounced' || key === 'open') {
    bg = brand.dangerBg;
    fg = brand.danger;
  } else if (key.includes('pending') || key === 'queued' || key === 'retrying' || key === 'in progress') {
    bg = '#f6efd2';
    fg = brand.warning;
  } else if (key === 'leave') {
    bg = '#e7eef8';
    fg = '#1e3a5f';
  }
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label ?? status}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: brand.primary,
        },
      ]}
    >
      <Text style={{ color: brand.primaryInk, fontWeight: '800', fontSize: size * 0.34 }}>
        {initials || '?'}
      </Text>
    </View>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (next: T) => void;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segments}>
      {options.map(([id, label]) => {
        const active = id === value;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            style={[
              styles.segment,
              {
                backgroundColor: active ? brand.primary : colors.cardElevated,
                borderColor: active ? brand.primary : colors.border,
              },
            ]}
          >
            <Text style={{ color: active ? brand.primaryInk : colors.text, fontWeight: '700', fontSize: 13 }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <View style={{ gap: 6, zIndex: open ? 30 : 0 }}>
      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{label}</Text>
      {Platform.OS === 'web' ? (
        createElement(
          'select',
          {
            'aria-label': label,
            value,
            onChange: (event: { target: { value: string } }) => onChange(event.target.value),
            style: {
              width: '100%',
              boxSizing: 'border-box',
              minHeight: 48,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: '12px',
              fontSize: 16,
              color: colors.text,
              backgroundColor: colors.cardElevated,
              fontFamily: 'inherit',
            },
          },
          options.map((option, index) =>
            createElement('option', { key: `${option.value}-${index}`, value: option.value }, option.label),
          ),
        )
      ) : (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => setOpen((current) => !current)}
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.cardElevated,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
            ]}
          >
            <Text style={{ color: selected ? colors.text : colors.textSecondary, fontSize: 16, flex: 1 }}>
              {selected?.label ?? 'Select'}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{open ? '▴' : '▾'}</Text>
          </Pressable>
          {open ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                backgroundColor: colors.card,
                overflow: 'hidden',
              }}
            >
              <ScrollView style={{ maxHeight: 260 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                {options.map((option, index) => {
                  const active = option.value === value;
                  return (
                    <Pressable
                      key={`${option.value}-${index}`}
                      onPress={() => {
                        onChange(option.value);
                        setOpen(false);
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 14,
                        backgroundColor: active ? colors.cardElevated : 'transparent',
                      }}
                    >
                      <Text style={{ color: colors.text, fontWeight: active ? '800' : '500', fontSize: 16 }}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
                {options.length === 0 ? (
                  <Text style={{ color: colors.textSecondary, padding: 12 }}>Nothing to choose.</Text>
                ) : null}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

export function SearchSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Search name',
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((option) => option.value === value);
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? options.filter((option) => option.label.toLowerCase().includes(needle))
    : options;

  return (
    <View style={{ gap: 6, zIndex: open ? 20 : 0 }}>
      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          setOpen((current) => !current);
          setQuery('');
        }}
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.cardElevated, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
      >
        <Text style={{ color: selected ? colors.text : colors.textSecondary, fontSize: 16, flex: 1 }}>
          {selected?.label ?? 'Select a person'}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      {open ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            backgroundColor: colors.card,
            overflow: 'hidden',
          }}
        >
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder}
            placeholderTextColor={colors.textSecondary}
            autoFocus={Platform.OS === 'web'}
            style={[
              styles.input,
              {
                color: colors.text,
                borderWidth: 0,
                borderBottomWidth: 1,
                borderColor: colors.border,
                borderRadius: 0,
                backgroundColor: colors.cardElevated,
              },
            ]}
          />
          <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {matches.map((option) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setQuery('');
                    setOpen(false);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 12,
                    backgroundColor: active ? colors.cardElevated : 'transparent',
                  }}
                >
                  <Text style={{ color: colors.text, fontWeight: active ? '800' : '500' }}>{option.label}</Text>
                </Pressable>
              );
            })}
            {matches.length === 0 ? (
              <Text style={{ color: colors.textSecondary, padding: 12 }}>No people match that name.</Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

export function FileField({
  label,
  accept = '.pdf,.png,.jpg,.jpeg,.doc,.docx',
  onChange,
  disabled,
}: {
  label: string;
  accept?: string;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{label}</Text>
      {Platform.OS === 'web' ? (
        createElement('input', {
          type: 'file',
          accept,
          'aria-label': label,
          disabled,
          onChange: (event: { target: { files?: ArrayLike<File> | null } }) =>
            onChange(event.target.files?.[0] ?? null),
          style: {
            width: '100%',
            boxSizing: 'border-box',
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '10px',
            fontSize: 14,
            color: colors.text,
            backgroundColor: colors.cardElevated,
            fontFamily: 'inherit',
          },
        })
      ) : (
        <Pressable
          disabled={disabled}
          onPress={() => {
            void pickLocalFile(accept).then(onChange);
          }}
          style={[styles.input, { borderColor: colors.border, backgroundColor: colors.cardElevated }]}
        >
          <Text style={{ color: colors.text }}>Choose PDF, PNG, JPG, DOC, or DOCX</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Field({
  label,
  ...input
}: { label: string } & TextInputProps) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        {...input}
        style={[
          styles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.cardElevated,
          },
          input.multiline ? { minHeight: 88, textAlignVertical: 'top' } : null,
          input.style,
        ]}
      />
    </View>
  );
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [open, setOpen] = useState(false);
  const selected = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date();

  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>{label}</Text>
      {Platform.OS === 'web' ? (
        createElement('input', {
          type: 'date',
          value,
          'aria-label': label,
          onChange: (event: { target: { value: string } }) => onChange(event.target.value),
          style: {
            width: '100%',
            boxSizing: 'border-box',
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '12px',
            fontSize: 16,
            color: colors.text,
            backgroundColor: colors.cardElevated,
            fontFamily: 'inherit',
            colorScheme: scheme === 'dark' ? 'dark' : 'light',
          },
        })
      ) : (
        <>
          <Pressable
            onPress={() => setOpen(true)}
            style={[
              styles.input,
              {
                borderColor: colors.border,
                backgroundColor: colors.cardElevated,
              },
            ]}
          >
            <Text style={{ color: value ? colors.text : colors.textSecondary, fontSize: 16 }}>
              {value || 'Select date'}
            </Text>
          </Pressable>
          {open ? (
            <DateTimePicker
              value={selected}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, date) => {
                if (Platform.OS === 'android' || event.type === 'dismissed' || event.type === 'set') {
                  setOpen(false);
                }
                if (event.type !== 'dismissed' && date) onChange(toIsoDate(date));
              }}
            />
          ) : null}
        </>
      )}
    </View>
  );
}

export function CheckRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  return (
    <View style={styles.checkRow}>
      <Text style={{ color: colors.text, flex: 1 }}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: brand.primary, false: colors.border }}
      />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        {
          backgroundColor: danger ? brand.danger : brand.primary,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <Text style={[styles.buttonText, { color: danger ? '#fff' : brand.primaryInk }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.ghost, { borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}
    >
      <Text style={{ color: colors.text, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

export function EmptyNote({ text }: { text: string }) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  return <Text style={{ color: colors.textSecondary }}>{text}</Text>;
}

export function RowLink({
  label,
  meta,
  onPress,
}: {
  label: string;
  meta?: string;
  onPress: () => void;
}) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  return (
    <Pressable onPress={onPress} style={[styles.rowLink, { borderColor: colors.border }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{label}</Text>
        {meta ? <Text style={{ color: colors.textSecondary }}>{meta}</Text> : null}
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

export function EssToast() {
  const { toast, clearToast } = useEssData();
  const [bus, setBus] = useState<string | null>(null);
  const message = bus ?? toast;

  useEffect(() => subscribeToast(setBus), []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setBus(null);
      clearToast();
    }, 2800);
    return () => clearTimeout(timer);
  }, [message, clearToast]);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={styles.toastWrap}>
      <View style={[styles.toast, { backgroundColor: brand.primary }]}>
        <Text style={{ color: brand.primaryInk, fontWeight: '700' }}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: { flex: 1, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center' },
  backBtn: { width: 56 },
  backSpacer: { width: 56 },
  backText: { fontWeight: '700' },
  scroll: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  meta: { gap: 2, flex: 1 },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaValue: { fontSize: 15 },
  insights: { flexDirection: 'row', gap: 8 },
  insight: { flex: 1, minWidth: 0, padding: 12 },
  insightValue: { fontSize: 18, fontWeight: '800' },
  chip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontSize: 12, fontWeight: '700' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  segments: { gap: 8, paddingVertical: 2 },
  segment: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  buttonText: { fontWeight: '700', fontSize: 16 },
  ghost: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  rowLink: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    gap: 8,
  },
  toastWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 88,
    zIndex: 50,
  },
  toast: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
