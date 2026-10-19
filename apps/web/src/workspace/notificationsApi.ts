import { apiFetch } from '../lib/api';

export type NotificationDto = {
  id: string;
  title: string;
  body: string;
  href: string;
  kind: string;
  read: boolean;
  createdAt: string;
};

export function fetchNotifications() {
  return apiFetch<NotificationDto[]>('/api/v1/notifications/me');
}

export function fetchUnreadNotificationCount() {
  return apiFetch<{ count: number }>('/api/v1/notifications/me/unread-count');
}

export function markNotificationRead(id: string) {
  return apiFetch<NotificationDto>(`/api/v1/notifications/me/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return apiFetch<{ ok: boolean }>('/api/v1/notifications/me/read-all', { method: 'POST' });
}
