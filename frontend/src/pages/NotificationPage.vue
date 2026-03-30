<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { notificationApi, type Notification } from '@/services/notification';
import { useNotificationStore } from '@/stores/notification';

const notifStore = useNotificationStore();
const notifications = ref<Notification[]>([]);
const loading = ref(false);

const typeLabels: Record<string, string> = {
  TASK_ASSIGNED: '任务分配',
  TASK_SCORE_READY: '评分完成',
  VOTE_STARTED: '投票开始',
  POINTS_AWARDED: '工分发放',
  SETTLEMENT_COMPLETE: '结算完成',
};

const typeIcons: Record<string, string> = {
  TASK_ASSIGNED: '📋',
  TASK_SCORE_READY: '⭐',
  VOTE_STARTED: '🗳️',
  POINTS_AWARDED: '🏆',
  SETTLEMENT_COMPLETE: '✅',
};

onMounted(async () => {
  loading.value = true;
  try {
    notifications.value = await notificationApi.list();
  } finally {
    loading.value = false;
  }
});

async function handleMarkAllRead() {
  await notificationApi.markAllRead();
  notifications.value = notifications.value.map((n) => ({ ...n, isRead: true }));
  notifStore.unreadCount = 0;
}

async function handleMarkRead(notif: Notification) {
  if (notif.isRead) return;
  await notificationApi.markRead(notif.id);
  notif.isRead = true;
  notifStore.unreadCount = Math.max(0, notifStore.unreadCount - 1);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-heading font-bold text-foreground">消息通知</h1>
        <p class="text-sm text-muted-foreground mt-0.5">查看系统消息与提醒</p>
      </div>
      <button
        class="px-4 py-1.5 text-sm rounded-md border border-border text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors duration-200 cursor-pointer"
        @click="handleMarkAllRead"
      >
        全部已读
      </button>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-16 bg-secondary rounded-lg animate-pulse" />
    </div>

    <!-- Empty state -->
    <div
      v-else-if="notifications.length === 0"
      class="text-center py-20 text-muted-foreground text-sm"
    >
      <div class="text-4xl mb-3">🔔</div>
      <p>暂无通知</p>
    </div>

    <!-- Notification list -->
    <div v-else class="space-y-2">
      <div
        v-for="notif in notifications"
        :key="notif.id"
        class="flex items-start gap-3 p-4 rounded-lg border transition-colors duration-200 cursor-pointer hover:bg-white/5"
        :class="
          notif.isRead
            ? 'glass-card'
            : 'bg-card/60 border-primary/30 shadow-sm'
        "
        @click="handleMarkRead(notif)"
      >
        <!-- Unread dot -->
        <div class="mt-1 flex-shrink-0">
          <span
            v-if="!notif.isRead"
            class="inline-block w-2 h-2 rounded-full bg-primary"
          />
          <span v-else class="inline-block w-2 h-2 rounded-full bg-transparent" />
        </div>

        <!-- Icon -->
        <span class="text-xl flex-shrink-0">{{ typeIcons[notif.type] ?? '📩' }}</span>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-xs text-muted-foreground">
              {{ typeLabels[notif.type] ?? notif.type }}
            </span>
          </div>
          <p class="text-sm font-medium text-foreground">{{ notif.title }}</p>
          <p class="text-sm text-muted-foreground mt-0.5 line-clamp-2">{{ notif.content }}</p>
        </div>

        <!-- Time -->
        <span class="text-xs font-mono text-muted-foreground flex-shrink-0 mt-0.5">
          {{ formatDate(notif.createdAt) }}
        </span>
      </div>
    </div>
  </div>
</template>
