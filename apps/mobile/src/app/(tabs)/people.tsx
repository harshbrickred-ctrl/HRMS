import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, useColorScheme } from 'react-native';
import { Avatar, Card, EmptyNote, Insights, Screen } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { personName } from '@/lib/hrApi';
import { useDirectory } from '@/lib/useDirectory';

export default function PeopleScreen() {
  const { people, me, loading, error } = useDirectory();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [location, setLocation] = useState('');

  const departments = useMemo(
    () => [...new Set(people.map((person) => person.departmentName || 'Unassigned'))].sort(),
    [people],
  );
  const locations = useMemo(
    () => [...new Set(people.map((person) => person.locationName || '—'))].sort(),
    [people],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return people.filter((person) => {
      const dept = person.departmentName || 'Unassigned';
      const loc = person.locationName || '—';
      if (department && dept !== department) return false;
      if (location && loc !== location) return false;
      if (!q) return true;
      const name = personName(person).toLowerCase();
      return (
        name.includes(q) ||
        person.designation.toLowerCase().includes(q) ||
        person.email.toLowerCase().includes(q) ||
        person.employeeCode.toLowerCase().includes(q) ||
        (person.teamName ?? '').toLowerCase().includes(q) ||
        dept.toLowerCase().includes(q)
      );
    });
  }, [people, query, department, location]);

  return (
    <Screen title="People">
      <Insights
        items={[
          ['People', people.length],
          ['Departments', departments.length],
          ['Locations', locations.length],
        ]}
      />
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={brand.primaryInk} /> : null}
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Name, role, team, or email"
        placeholderTextColor={colors.textSecondary}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 12,
          color: colors.text,
          backgroundColor: colors.cardElevated,
        }}
      />
      <Text style={{ color: colors.textSecondary }}>
        Department: {department || 'All'} · Location: {location || 'All'}
      </Text>
      <Text style={{ color: colors.text, fontWeight: '700' }}>Departments</Text>
      {departments.map((name) => (
        <Pressable key={name} onPress={() => setDepartment((current) => (current === name ? '' : name))}>
          <Text style={{ color: department === name ? colors.text : colors.textSecondary, fontWeight: '700' }}>
            {name}
          </Text>
        </Pressable>
      ))}
      <Text style={{ color: colors.text, fontWeight: '700' }}>Locations</Text>
      {locations.map((name) => (
        <Pressable key={name} onPress={() => setLocation((current) => (current === name ? '' : name))}>
          <Text style={{ color: location === name ? colors.text : colors.textSecondary, fontWeight: '700' }}>
            {name}
          </Text>
        </Pressable>
      ))}
      {filtered.length === 0 && !loading ? <EmptyNote text="No one matches these filters." /> : null}
      {filtered.map((person) => (
        <Pressable key={person.id} onPress={() => router.push(`/people/${person.id}`)}>
          <Card>
            <Avatar name={personName(person)} />
            <Text style={{ color: colors.text, fontWeight: '800' }}>
              {personName(person)}
              {person.id === me?.id ? ' · You' : ''}
            </Text>
            <Text style={{ color: colors.textSecondary }}>{person.designation}</Text>
            <Text style={{ color: colors.textSecondary }}>
              {person.employeeCode} · {person.departmentName || 'Unassigned'} · {person.teamName || 'No team'}
            </Text>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
