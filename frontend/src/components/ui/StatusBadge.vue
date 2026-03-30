<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/services/task';

const props = defineProps<{ status: TaskStatus }>();

const statusConfig: Record<TaskStatus, { label: string; class: string }> = {
  open: { label: '待认领', class: 'bg-muted text-muted-foreground border-border' },
  claimed: { label: '进行中', class: 'bg-primary/10 text-primary border-primary/30' },
  submitted: { label: '已提交', class: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  ai_reviewing: { label: 'AI审中', class: 'bg-accent/10 text-accent border-accent/30' },
  pending_vote: { label: '待投票', class: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  settled: { label: '已固化', class: 'bg-green-500/10 text-green-400 border-green-500/30' },
  cancelled: { label: '已取消', class: 'bg-red-500/10 text-red-400 border-red-500/30 line-through' },
};

const config = computed(() => statusConfig[props.status] ?? { label: props.status, class: 'bg-muted text-muted-foreground border-border' });
</script>

<template>
  <span :class="cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border', config.class)">
    {{ config.label }}
  </span>
</template>
