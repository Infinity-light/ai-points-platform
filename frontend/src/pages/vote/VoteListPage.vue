<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { projectApi, type Project } from '@/services/project';
import { voteApi, type VoteSession } from '@/services/vote';

const router = useRouter();

const projects = ref<Project[]>([]);
const selectedProjectId = ref('');
const sessions = ref<VoteSession[]>([]);
const loading = ref(false);

onMounted(async () => {
  const res = await projectApi.list(true);
  projects.value = res.data.filter((p) => p.status === 'active');
  if (projects.value.length > 0) {
    selectedProjectId.value = projects.value[0].id;
    await loadSessions();
  }
});

async function loadSessions() {
  if (!selectedProjectId.value) return;
  loading.value = true;
  try {
    const res = await voteApi.listByProject(selectedProjectId.value);
    sessions.value = res.data;
  } finally {
    loading.value = false;
  }
}

const statusConfig: Record<string, { label: string; class: string }> = {
  open: { label: '投票中', class: 'bg-blue-100 text-blue-700' },
  closed: { label: '已关闭', class: 'bg-gray-100 text-gray-600' },
  passed: { label: '已通过', class: 'bg-green-100 text-green-700' },
  failed: { label: '未通过', class: 'bg-red-100 text-red-600' },
};

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
  <div class="p-6 max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-foreground">投票会议</h1>
        <p class="text-sm text-muted-foreground mt-0.5">工分审核与固化</p>
      </div>
    </div>

    <!-- Project selector -->
    <div class="flex gap-2 mb-6 overflow-x-auto pb-1">
      <button
        v-for="p in projects"
        :key="p.id"
        class="px-4 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors border"
        :class="
          selectedProjectId === p.id
            ? 'bg-primary text-primary-foreground border-primary'
            : 'border-border text-muted-foreground hover:bg-accent'
        "
        @click="
          selectedProjectId = p.id;
          loadSessions();
        "
      >
        {{ p.name }}
      </button>
    </div>

    <!-- Sessions list -->
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="h-20 bg-muted rounded-lg animate-pulse" />
    </div>

    <div
      v-else-if="sessions.length === 0"
      class="text-center py-16 text-muted-foreground text-sm"
    >
      此项目暂无投票会议
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors cursor-pointer"
        @click="router.push(`/vote/${session.id}`)"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <span
              class="px-2 py-0.5 text-xs rounded-full font-medium"
              :class="statusConfig[session.status]?.class"
            >
              {{ statusConfig[session.status]?.label }}
            </span>
            <span class="text-sm text-muted-foreground">{{ session.taskIds.length }} 个任务</span>
          </div>
          <span class="text-xs text-muted-foreground">{{ formatDate(session.createdAt) }}</span>
        </div>

        <!-- Result bar if closed -->
        <div
          v-if="session.status === 'passed' || session.status === 'failed'"
          class="mt-3"
        >
          <div class="flex justify-between text-xs text-muted-foreground mb-1">
            <span>
              加权赞成率
              {{ ((session.result.weightedYesRatio ?? 0) * 100).toFixed(0) }}%
            </span>
            <span>
              参与率 {{ ((session.result.participationRatio ?? 0) * 100).toFixed(0) }}%
            </span>
          </div>
          <div class="h-2 bg-muted rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all"
              :class="session.status === 'passed' ? 'bg-green-500' : 'bg-red-400'"
              :style="{ width: `${(session.result.weightedYesRatio ?? 0) * 100}%` }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
