import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import { Card, Screen } from '@/components/ui';
import { Spacing, useThemeColors } from '@/constants/theme';
import { essData } from '@/mock/essData';

export default function PeopleScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [q, setQ] = useState('');

  const people = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return essData.people;
    return essData.people.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.department.toLowerCase().includes(needle) ||
        p.employeeCode.toLowerCase().includes(needle),
    );
  }, [q]);

  return (
    <Screen title="People">
      <TextInput
        placeholder="Search name, dept, code…"
        placeholderTextColor={colors.textSecondary}
        value={q}
        onChangeText={setQ}
        style={[
          styles.search,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.card,
          },
        ]}
      />
      {people.map((p) => (
        <Card key={p.id}>
          <View style={styles.rowBetween}>
            <Text style={[styles.title, { color: colors.text }]}>{p.name}</Text>
            {p.isSelf ? (
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>You</Text>
            ) : null}
          </View>
          <Text style={{ color: colors.textSecondary }}>
            {p.title} · {p.department}
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            {p.employeeCode} · {p.location}
          </Text>
          <Text style={{ color: colors.text }}>{p.workEmail}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: Spacing.xs,
  },
  title: { fontSize: 16, fontWeight: '700' },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
