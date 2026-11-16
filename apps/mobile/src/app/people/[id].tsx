import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, Text, useColorScheme } from 'react-native';
import { Avatar, Card, EmptyNote, Meta, PrimaryButton, Screen } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { personName } from '@/lib/hrApi';
import { useDirectory } from '@/lib/useDirectory';

export default function PersonDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { people, me, loading, error } = useDirectory();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const person = people.find((item) => item.id === id);
  const reports = people.filter((item) => item.managerId === person?.id && item.id !== person?.id);

  if (loading) {
    return (
      <Screen title="People" back>
        <ActivityIndicator color={brand.primaryInk} />
      </Screen>
    );
  }

  if (!person) {
    return (
      <Screen title="People" back>
        <Card>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Person not found</Text>
          <EmptyNote text={error || 'This directory entry does not exist.'} />
          <PrimaryButton label="Back to People" onPress={() => router.replace('/(tabs)/people')} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={personName(person)} back>
      {person.id === me?.id ? (
        <PrimaryButton label="Open my profile" onPress={() => router.push('/profile')} />
      ) : null}
      <Card>
        <Avatar name={personName(person)} size={64} />
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>{personName(person)}</Text>
        <Text style={{ color: colors.textSecondary }}>
          {person.designation} · {person.employeeCode}
        </Text>
        <Meta label="Employee id" value={person.employeeCode} />
        <Meta label="Department" value={person.departmentName || 'Unassigned'} />
        <Meta label="Team" value={person.teamName || '—'} />
        <Meta label="Location" value={person.locationName || '—'} />
        <Meta label="Work email" value={person.email} />
        <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Manager</Text>
        {person.managerId ? (
          <Pressable onPress={() => router.push(`/people/${person.managerId}`)}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{person.managerName || 'Manager'}</Text>
          </Pressable>
        ) : (
          <Text style={{ color: colors.text }}>{person.managerName || '—'}</Text>
        )}
        <Text style={{ color: colors.text, fontWeight: '800' }}>Reports</Text>
        {reports.length === 0 ? <EmptyNote text="No direct reports." /> : null}
        {reports.map((report) => (
          <Pressable key={report.id} onPress={() => router.push(`/people/${report.id}`)}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{personName(report)}</Text>
            <Text style={{ color: colors.textSecondary }}>{report.designation}</Text>
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}
