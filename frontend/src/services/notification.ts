import api from '@/lib/axios';

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export const notificationApi = {
  list: () => api.get<Notification[]>('/notifications').then((r) => r.data),
  getUnreadCount: () =>
    api.get<{ count: number }>('/notifications/unread-count').then((r) => r.data),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};
