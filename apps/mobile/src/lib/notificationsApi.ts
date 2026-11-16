import { apiFetch } from './api';

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
  return apiFetch<NotificationDto[]>('/notifications/me');
}

export function fetchUnreadNotificationCount() {
  return apiFetch<{ count: number }>('/notifications/me/unread-count');
}

export function markNotificationRead(id: string) {
  return apiFetch<NotificationDto>(`/notifications/me/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return apiFetch<{ ok: boolean }>('/notifications/me/read-all', { method: 'POST' });
}
