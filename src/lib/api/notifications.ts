import { apiClient } from './instance';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  level: string;
  isRead: boolean;
  actionUrl: string | null;
  createdAt: string;
}

export const notificationsApi = {
  getUnreadCount: () =>
    apiClient.get<{ data: { count: number } }>('/notifications/unread-count'),

  list: (params?: { size?: number }) =>
    apiClient.get<{ data: NotificationItem[] }>('/notifications', { params }),

  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`),

  markAllRead: () =>
    apiClient.patch('/notifications/read-all'),
} as const;
