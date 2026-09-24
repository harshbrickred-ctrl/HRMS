import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { Card, Screen } from '@/components/ui';
import { useThemeColors } from '@/constants/theme';
import { essData } from '@/mock/essData';

export default function DocumentsScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);

  return (
    <Screen title="Documents">
      {essData.documents.map((doc) => (
        <Card key={doc.id}>
          <View style={styles.rowBetween}>
            <Text style={[styles.title, { color: colors.text }]}>{doc.name}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {doc.owner === 'mine' ? 'Mine' : 'Company'}
            </Text>
          </View>
          <Text style={{ color: colors.textSecondary }}>
            {doc.category} · {doc.sizeLabel} · {doc.uploadedAt}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 15, fontWeight: '700', flex: 1, paddingRight: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
});
