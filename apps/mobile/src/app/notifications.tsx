import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, useColorScheme } from 'react-native';
import { Card, EmptyNote, GhostButton, Insights, Screen, Segmented } from '@/components/ui';
import { brand, useThemeColors } from '@/constants/theme';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationDto,
} from '@/lib/notificationsApi';
import { hrefToRoute } from '@/lib/routes';

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function NotificationsScreen() {
  const scheme = useColorScheme();
  const colors = useThemeColors(scheme);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchNotifications()
      .then((rows) => {
        setNotifications(rows);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load notifications.'));
  }

  useEffect(() => {
    load();
  }, []);

  const unreadCount = notifications.filter((item) => !item.read).length;
  const visible = filter === 'unread' ? notifications.filter((item) => !item.read) : notifications;

  return (
    <Screen title="Notifications" back>
      <Insights
        items={[
          ['Unread', unreadCount],
          ['All', notifications.length],
          ['Read', notifications.length - unreadCount],
        ]}
      />
      {error ? <Text style={{ color: brand.danger }}>{error}</Text> : null}
      <Segmented
        value={filter}
        options={[
          ['all', 'All'],
          ['unread', 'Unread'],
        ]}
        onChange={setFilter}
      />
      <GhostButton
        label="Mark all read"
        disabled={unreadCount === 0}
        onPress={() => {
          void markAllNotificationsRead().then(load);
        }}
      />
      {visible.length === 0 ? <EmptyNote text="No notifications." /> : null}
      {visible.map((item) => (
        <Card key={item.id}>
          <Text style={{ color: colors.text, fontWeight: '800' }}>{item.title}</Text>
          <Text style={{ color: colors.textSecondary }}>{formatWhen(item.createdAt)}</Text>
          <Text style={{ color: colors.textSecondary }}>{item.body}</Text>
          {item.href ? (
            <Pressable onPress={() => router.push(hrefToRoute(item.href))}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Open</Text>
            </Pressable>
          ) : null}
          {!item.read ? (
            <GhostButton
              label="Mark read"
              onPress={() => {
                void markNotificationRead(item.id).then(load);
              }}
            />
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}
