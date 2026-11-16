import { useEffect, useState } from 'react';
import { Text, useColorScheme } from 'react-native';
import { Card, EmptyNote, PrimaryButton, Screen } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { downloadMyPayslip, fetchMyPayslips, type PayslipDto } from '@/lib/payslipApi';
import { showToast } from '@/lib/toast';

export default function SalaryScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [payslips, setPayslips] = useState<PayslipDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchMyPayslips()
      .then((rows) => {
        setPayslips(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load payslips.'));
  }, []);

  return (
    <Screen title="Salary" back>
      <Card>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>Payslips</Text>
        <Text style={{ color: colors.textSecondary }}>
          PeopleOS stores payslip PDFs uploaded by HR. It is not the payroll engine.
        </Text>
        {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
        {message ? <Text style={{ color: colors.textSecondary }}>{message}</Text> : null}
        {payslips.length === 0 ? <EmptyNote text="No payslips have been uploaded for you yet." /> : null}
        {payslips.map((slip) => (
          <Card key={slip.id}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{slip.label}</Text>
            <Text style={{ color: colors.textSecondary }}>
              {slip.month} · {slip.fileName}
            </Text>
            <PrimaryButton
              label="Download PDF"
              onPress={() => {
                void downloadMyPayslip(slip.id, slip.fileName)
                  .then(() => {
                    setMessage('Download started.');
                    showToast('Download started.');
                  })
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Download failed.'));
              }}
            />
          </Card>
        ))}
      </Card>
    </Screen>
  );
}
