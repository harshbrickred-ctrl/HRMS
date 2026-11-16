import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, Text, View, useColorScheme } from 'react-native';
import { useAuth } from '@/lib/auth';
import { brand, useThemeColors } from '@/constants/theme';

const TAB_ICONS = {
  index: { active: 'home', inactive: 'home-outline' },
  leave: { active: 'calendar', inactive: 'calendar-outline' },
  attendance: { active: 'time', inactive: 'time-outline' },
  people: { active: 'people', inactive: 'people-outline' },
  more: { active: 'grid', inactive: 'grid-outline' },
} as const;

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
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? TAB_ICONS.index.active : TAB_ICONS.index.inactive} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="leave"
        options={{
          title: 'Leave',
          tabBarLabel: ({ focused }) => <TabLabel label="Leave" focused={focused} />,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? TAB_ICONS.leave.active : TAB_ICONS.leave.inactive} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarLabel: ({ focused }) => (
            <TabLabel label="Attendance" focused={focused} />
          ),
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? TAB_ICONS.attendance.active : TAB_ICONS.attendance.inactive}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarLabel: ({ focused }) => <TabLabel label="People" focused={focused} />,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? TAB_ICONS.people.active : TAB_ICONS.people.inactive} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarLabel: ({ focused }) => <TabLabel label="More" focused={focused} />,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? TAB_ICONS.more.active : TAB_ICONS.more.inactive} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
