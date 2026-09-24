import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Text, View, useColorScheme } from 'react-native';
import { useAuth } from '@/lib/auth';
import { brand, useThemeColors } from '@/constants/theme';

function TabLabel({ label, focused }: { label: string; focused: boolean }) {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: focused ? '700' : '600',
        color: focused ? colors.text : colors.textSecondary,
      }}
    >
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={brand.primaryInk} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.cardElevated,
          borderTopColor: colors.border,
        },
        tabBarActiveBackgroundColor:
          scheme === 'dark' ? '#2a2e28' : '#eef6c8',
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: ({ focused }) => <TabLabel label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          title: 'Leave',
          tabBarLabel: ({ focused }) => <TabLabel label="Leave" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Attendance" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarLabel: ({ focused }) => <TabLabel label="People" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarLabel: ({ focused }) => <TabLabel label="More" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
