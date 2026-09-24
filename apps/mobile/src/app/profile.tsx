import { Text, useColorScheme } from 'react-native';
import { Card, Meta, Screen } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';
import { essData } from '@/mock/essData';

export default function ProfileScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const p = essData.profile;

  return (
    <Screen title="Profile">
      <Card>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: '800' }}>
          {p.firstName} {p.lastName}
        </Text>
        <Text style={{ color: colors.textSecondary }}>
          {p.title} · {p.department}
        </Text>
      </Card>
      <Card>
        <Meta label="Employee code" value={p.employeeCode} />
        <Meta label="Location" value={p.location} />
        <Meta label="Join date" value={p.joinDate} />
        <Meta label="Manager" value={p.managerName} />
        <Meta label="Work email" value={p.workEmail} />
        <Meta label="Work phone" value={p.workPhone} />
        <Meta label="Mobile" value={p.mobile} />
      </Card>
    </Screen>
  );
}
