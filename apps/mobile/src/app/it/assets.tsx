import { useEffect, useState } from 'react';
import { Text, useColorScheme } from 'react-native';
import { Card, EmptyNote, Screen, StatusChip } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { categoryLabel, fetchAssets, type AssetRecord } from '@/lib/assetsApi';

export default function ItAssetsScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [rows, setRows] = useState<AssetRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets()
      .then((data) => {
        setRows(data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not load assets.'),
      );
  }, []);

  return (
    <Screen title="Asset register" back>
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      {rows.length === 0 && !error ? <EmptyNote text="No assets in the register yet." /> : null}
      {rows.map((asset) => (
        <Card key={asset.id}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>
            {asset.assetTag} · {categoryLabel(asset.category)}
          </Text>
          <Text style={{ color: colors.textSecondary }}>
            {asset.makeModel || '—'}
            {asset.serialNo ? ` · ${asset.serialNo}` : ''}
          </Text>
          <StatusChip status={asset.status === 'in_stock' ? 'approved' : 'pending'} label={asset.status} />
          <Text style={{ color: colors.textSecondary }}>
            {asset.current
              ? `With ${asset.current.name} (${asset.current.employeeCode})`
              : 'Unassigned'}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
