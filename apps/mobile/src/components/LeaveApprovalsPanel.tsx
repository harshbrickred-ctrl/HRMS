import { useEffect, useState } from 'react';
import { Text, useColorScheme } from 'react-native';
import { Card, EmptyNote, Field, PrimaryButton, StatusChip } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { showToast } from '@/lib/toast';
import { decideLeaveRequest, fetchCompanyLeave, type LeaveRequestDto } from '@/lib/leaveApi';

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Could not update that leave.';
}

export function LeaveApprovalsPanel() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  function load() {
    fetchCompanyLeave()
      .then((data) => {
        setRequests(data.requests);
        setError(null);
      })
      .catch((err: unknown) => setError(messageOf(err)));
  }

  useEffect(() => {
    load();
  }, []);

  async function onDecide(id: string, status: 'Approved' | 'Rejected', note?: string) {
    setBusyId(id);
    setError(null);
    try {
      await decideLeaveRequest(id, status, note);
      showToast(status === 'Approved' ? 'Leave approved.' : 'Leave rejected.');
      setRejectId(null);
      setRejectNote('');
      load();
    } catch (err: unknown) {
      setError(messageOf(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Leave requests</Text>
      <Text style={{ color: colors.textSecondary }}>
        Approve or reject leave applied by anyone in the company.
      </Text>
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      {requests.length === 0 ? <EmptyNote text="No leave is waiting." /> : null}
      {requests.map((item) => (
        <Card key={item.id}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {item.person?.name ?? 'Employee'} · {item.type}
          </Text>
          <StatusChip status={item.status} />
          <Text style={{ color: colors.textSecondary }}>
            {item.startDate}
            {item.endDate !== item.startDate ? ` – ${item.endDate}` : ''} · {item.days} day(s)
            {item.reason ? ` · ${item.reason}` : ''}
          </Text>
          <PrimaryButton
            label={busyId === item.id ? 'Saving…' : 'Approve'}
            disabled={busyId === item.id}
            onPress={() => void onDecide(item.id, 'Approved')}
          />
          {rejectId === item.id ? (
            <>
              <Field label="Rejection comment" value={rejectNote} onChangeText={setRejectNote} multiline />
              <PrimaryButton
                danger
                label="Confirm reject"
                disabled={busyId === item.id || !rejectNote.trim()}
                onPress={() => void onDecide(item.id, 'Rejected', rejectNote.trim())}
              />
            </>
          ) : (
            <PrimaryButton
              danger
              label="Reject"
              disabled={busyId === item.id}
              onPress={() => {
                setRejectId(item.id);
                setRejectNote('');
              }}
            />
          )}
        </Card>
      ))}
    </>
  );
}
