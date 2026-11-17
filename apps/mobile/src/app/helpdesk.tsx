import { useEffect, useState } from 'react';
import { Text, useColorScheme } from 'react-native';
import { Card, EmptyNote, Field, Insights, PrimaryButton, Screen, Segmented, StatusChip } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { showToast } from '@/lib/toast';
import { createTicket, fetchMyTickets, type HelpdeskTicketDto } from '@/lib/helpdeskApi';

const CATEGORIES = ['Payroll', 'Leave', 'Attendance', 'Access'] as const;

export default function HelpdeskScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [tickets, setTickets] = useState<HelpdeskTicketDto[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Payroll');
  const [error, setError] = useState<string | null>(null);
  const open = tickets.filter((ticket) => ticket.status !== 'Resolved' && ticket.status !== 'Closed').length;

  function load() {
    fetchMyTickets()
      .then((rows) => {
        setTickets(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load tickets.'));
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit() {
    if (!subject.trim() || !body.trim()) return;
    try {
      await createTicket({ subject, category, body });
      setSubject('');
      setBody('');
      load();
      showToast('Ticket submitted.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create the ticket.');
    }
  }

  return (
    <Screen title="Helpdesk" back>
      <Insights
        items={[
          ['Open', open],
          ['Tickets', tickets.length],
          ['Resolved', tickets.length - open],
        ]}
      />
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      <Card>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>My tickets</Text>
        {tickets.length === 0 ? <EmptyNote text="No tickets yet." /> : null}
        {tickets.map((ticket) => (
          <Card key={ticket.id}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{ticket.subject}</Text>
            <StatusChip status={ticket.status} />
            <Text style={{ color: colors.textSecondary }}>
              {ticket.category} · {new Date(ticket.createdAt).toLocaleDateString('en-IN')}
            </Text>
            <Text style={{ color: colors.textSecondary }}>{ticket.body}</Text>
          </Card>
        ))}
      </Card>
      <Card>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>New ticket</Text>
        <Field label="Subject" value={subject} onChangeText={setSubject} />
        <Segmented
          value={category}
          options={CATEGORIES.map((item) => [item, item])}
          onChange={setCategory}
        />
        <Field label="Details" value={body} onChangeText={setBody} multiline />
        <PrimaryButton label="Submit ticket" onPress={() => void onSubmit()} />
      </Card>
    </Screen>
  );
}
