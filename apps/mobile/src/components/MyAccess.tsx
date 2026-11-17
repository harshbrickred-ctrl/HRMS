import { Text, useColorScheme, View } from 'react-native';
import { Card, EmptyNote } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';
import { PERMISSION_GROUPS, PERMISSION_LABELS, roleLabel } from '@/lib/roleCatalog';

export function MyAccess() {
  const { user, permissions } = useAuth();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const granted = new Set(permissions);
  const known = new Set(PERMISSION_GROUPS.flatMap((group) => group.codes));
  const extra = permissions.filter((code) => !known.has(code));
  const roles = user?.roles ?? [];

  return (
    <>
      <Text style={{ color: colors.textSecondary }}>
        Signed in as {user?.email ?? 'this account'}. These come from your roles.
      </Text>

      <Card>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Your roles</Text>
        {roles.length === 0 ? <EmptyNote text="No role is assigned to this login." /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {roles.map((code) => (
            <View
              key={code}
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderColor: brand.primary,
                backgroundColor: brand.primary,
                paddingHorizontal: 12,
                paddingVertical: 8,
                minWidth: 120,
              }}
            >
              <Text style={{ color: brand.primaryInk, fontWeight: '800' }}>{roleLabel(code)}</Text>
              <Text style={{ color: brand.primaryInk, fontSize: 11, opacity: 0.75 }}>{code}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 18 }}>Your permissions</Text>
        <Text style={{ color: colors.textSecondary }}>{granted.size} on this login</Text>
        {granted.size === 0 ? <EmptyNote text="This login has no permissions yet." /> : null}
        {PERMISSION_GROUPS.map((group) => {
          const active = group.codes.filter((code) => granted.has(code));
          if (active.length === 0) return null;
          return (
            <View key={group.title} style={{ gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{group.title}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {active.map((code) => (
                  <View
                    key={code}
                    style={{
                      borderRadius: 999,
                      backgroundColor: brand.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                    }}
                  >
                    <Text style={{ color: brand.primaryInk, fontWeight: '700', fontSize: 13 }}>
                      {PERMISSION_LABELS[code] ?? code}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
        {extra.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Other</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {extra.map((code) => (
                <View
                  key={code}
                  style={{
                    borderRadius: 999,
                    backgroundColor: brand.primary,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                  }}
                >
                  <Text style={{ color: brand.primaryInk, fontWeight: '700', fontSize: 13 }}>
                    {PERMISSION_LABELS[code] ?? code}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </Card>
    </>
  );
}
