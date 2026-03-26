import { defineStore } from 'pinia';
import { ref } from 'vue';
import { notificationApi } from '@/services/notification';

export const useNotificationStore = defineStore('notification', () => {
  const unreadCount = ref(0);

  async function fetchUnreadCount() {
    try {
      const res = await notificationApi.getUnreadCount();
      unreadCount.value = res.count;
    } catch {
      // silently ignore errors (e.g. unauthenticated)
    }
  }

  return { unreadCount, fetchUnreadCount };
});
