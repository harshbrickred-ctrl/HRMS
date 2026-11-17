import { useEffect, useState } from 'react';
import { Text, useColorScheme } from 'react-native';
import { Card, EmptyNote, Screen, StatusChip } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { categoryLabel, fetchAssetTickets, type AssetTicket } from '@/lib/assetsApi';

export default function ItAssetTicketsScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [rows, setRows] = useState<AssetTicket[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssetTickets()
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load tickets.'),
      );
  }, []);

  return (
    <Screen title="Asset tickets" back>
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      {rows.length === 0 && !error ? <EmptyNote text="No asset tickets yet." /> : null}
      {rows.map((ticket) => (
        <Card key={ticket.id}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>{ticket.subject}</Text>
          <Text style={{ color: colors.textSecondary }}>
            {ticket.type}
            {ticket.category ? ` · ${categoryLabel(ticket.category)}` : ''}
            {ticket.asset ? ` · ${ticket.asset.assetTag}` : ''}
          </Text>
          <StatusChip
            status={ticket.status === 'Resolved' || ticket.status === 'Closed' ? 'approved' : 'pending'}
            label={ticket.status}
          />
          <Text style={{ color: colors.textSecondary }}>{ticket.body}</Text>
          {ticket.person ? (
            <Text style={{ color: colors.textSecondary }}>
              {ticket.person.name} · {ticket.person.employeeCode}
            </Text>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
