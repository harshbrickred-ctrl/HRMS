import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useColorScheme } from 'react-native';
import { Avatar, Card, EmptyNote, Insights, Screen, StatusChip } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { personName } from '@/lib/hrApi';
import { fetchMyLeave, type LeaveRequestDto } from '@/lib/leaveApi';
import { useDirectory } from '@/lib/useDirectory';

export default function TeamScreen() {
  const { people, me, loading, error } = useDirectory();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [pending, setPending] = useState<LeaveRequestDto[]>([]);

  useEffect(() => {
    fetchMyLeave()
      .then((data) => setPending(data.requests.filter((item) => item.status === 'Pending')))
      .catch(() => setPending([]));
  }, []);

  if (loading) {
    return (
      <Screen title="My Team" back>
        <ActivityIndicator color={brand.primaryInk} />
      </Screen>
    );
  }

  if (!me) {
    return (
      <Screen title="My Team" back>
        <Card>
          <EmptyNote text={error || 'Your employee record is not in the directory.'} />
        </Card>
      </Screen>
    );
  }

  const manager = me.managerId ? people.find((person) => person.id === me.managerId) : undefined;
  const teammates = people.filter(
    (person) => person.teamId && person.teamId === me.teamId && person.id !== me.id,
  );
  const leads = teammates.some((person) => person.managerId === me.id);

  return (
    <Screen title="My Team" back>
      <Insights
        items={[
          ['Team', me.teamName || 'Unassigned'],
          ['People', teammates.length + 1],
          ['Waiting', pending.length],
        ]}
      />
      <Text style={{ color: colors.textSecondary }}>
        {me.departmentName || 'Unassigned'}
        {me.teamName ? ` · ${me.teamName}` : ''}
        {me.teamName ? (leads ? '. You lead this team.' : '. You are on this team.') : '.'}
      </Text>
      {!me.teamId ? (
        <Card>
          <EmptyNote text="You are not assigned to a team." />
        </Card>
      ) : (
        <Card>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Reporting line</Text>
          {manager ? (
            <Pressable onPress={() => router.push(`/people/${manager.id}`)}>
              <Avatar name={personName(manager)} />
              <Text style={{ color: colors.textSecondary }}>Manager</Text>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{personName(manager)}</Text>
              <Text style={{ color: colors.textSecondary }}>{manager.designation}</Text>
            </Pressable>
          ) : null}
          <Text style={{ color: colors.textSecondary }}>You</Text>
          <Text style={{ color: colors.text, fontWeight: '700' }}>{personName(me)}</Text>
          <Text style={{ color: colors.text, fontWeight: '800' }}>{leads ? 'People you lead' : 'Teammates'}</Text>
          {teammates.length === 0 ? <EmptyNote text="No other people are on this team." /> : null}
          {teammates.map((person) => (
            <Pressable key={person.id} onPress={() => router.push(`/people/${person.id}`)}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{personName(person)}</Text>
              <Text style={{ color: colors.textSecondary }}>{person.designation}</Text>
            </Pressable>
          ))}
        </Card>
      )}
      <Card>
        <Text style={{ color: colors.text, fontWeight: '800' }}>
          Requests waiting on {manager ? personName(manager) : 'your manager'}
        </Text>
        {pending.length === 0 ? (
          <EmptyNote text={`Nothing is waiting on ${manager ? personName(manager) : 'your manager'}.`} />
        ) : (
          pending.map((item) => (
            <Pressable key={item.id} onPress={() => router.push('/(tabs)/leave')}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{item.type}</Text>
              <StatusChip status={item.status} />
              <Text style={{ color: colors.textSecondary }}>{item.reason}</Text>
            </Pressable>
          ))
        )}
      </Card>
    </Screen>
  );
}
