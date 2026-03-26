<script setup lang="ts">
import { computed } from 'vue';
import { cn } from '@/lib/utils';
import type { TaskStatus } from '@/services/task';

const props = defineProps<{ status: TaskStatus }>();

const statusConfig: Record<TaskStatus, { label: string; class: string }> = {
  open: { label: '待认领', class: 'bg-slate-100 text-slate-600' },
  claimed: { label: '进行中', class: 'bg-blue-100 text-blue-700' },
  submitted: { label: '已提交', class: 'bg-amber-100 text-amber-700' },
  ai_reviewing: { label: 'AI审中', class: 'bg-purple-100 text-purple-700' },
  pending_vote: { label: '待投票', class: 'bg-orange-100 text-orange-700' },
  settled: { label: '已固化', class: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', class: 'bg-red-100 text-red-600 line-through' },
};

const config = computed(() => statusConfig[props.status] ?? { label: props.status, class: 'bg-gray-100 text-gray-600' });
</script>

<template>
  <span :class="cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', config.class)">
    {{ config.label }}
  </span>
</template>
