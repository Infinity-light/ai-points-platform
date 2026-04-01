<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { bulletinApi, type DecisionEntry } from '@/services/bulletin';
import { ChevronDown, ChevronRight, Users } from 'lucide-vue-next';

const decisions = ref<DecisionEntry[]>([]);
const total = ref(0);
const loading = ref(true);
const error = ref('');
const expandedIds = ref<Set<string>>(new Set());

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await bulletinApi.getDecisions({ page: 1, limit: 20 });
    decisions.value = res.data.data;
    total.value = res.data.meta.total;
  } catch (e) {
    error.value = '加载决策记录失败';
  } finally {
    loading.value = false;
  }
}

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id);
  } else {
    expandedIds.value.add(id);
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = { open: '进行中', closed: '已结束', cancelled: '已取消' };
  return map[status] ?? status;
}

function statusClass(status: string): string {
  if (status === 'open') return 'text-green-400 bg-green-400/10';
  if (status === 'closed') return 'text-blue-400 bg-blue-400/10';
  return 'text-muted-foreground bg-secondary';
}

onMounted(load);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-medium text-foreground">评审决策（共 {{ total }} 次）</h2>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-16 bg-secondary rounded-lg animate-pulse" />
    </div>
    <div v-else-if="error" class="text-center py-8 text-muted-foreground text-sm">{{ error }}</div>
    <div v-else-if="decisions.length === 0" class="text-center py-8 text-muted-foreground text-sm">
      暂无决策记录
    </div>

    <div v-else class="space-y-2">
      <div v-for="d in decisions" :key="d.meetingId" class="glass-card overflow-hidden">
        <!-- 主行 -->
        <button
          class="w-full p-4 text-left flex items-center justify-between"
          @click="toggleExpand(d.meetingId)"
        >
          <div class="flex items-start gap-3">
            <component
              :is="expandedIds.has(d.meetingId) ? ChevronDown : ChevronRight"
              class="w-4 h-4 text-muted-foreground mt-0.5 shrink-0"
            />
            <div>
              <div class="flex items-center gap-2 mb-0.5">
                <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="statusClass(d.status)">
                  {{ statusLabel(d.status) }}
                </span>
                <span class="text-xs text-muted-foreground">{{ d.taskCount }} 个任务</span>
              </div>
              <p class="text-xs text-muted-foreground flex items-center gap-1">
                <Users class="w-3 h-3" />
                {{ d.participantCount }} 人参与 ·
                {{ new Date(d.createdAt).toLocaleDateString('zh-CN') }}
              </p>
            </div>
          </div>
          <p v-if="d.closedAt" class="text-xs text-muted-foreground shrink-0">
            {{ new Date(d.closedAt).toLocaleDateString('zh-CN') }} 结束
          </p>
        </button>

        <!-- 展开内容：投票详情 -->
        <div v-if="expandedIds.has(d.meetingId) && d.results" class="border-t border-border px-4 pb-4">
          <p class="text-xs text-muted-foreground mt-3 mb-2">任务投票结果</p>
          <div class="space-y-2">
            <div
              v-for="(result, taskId) in d.results"
              :key="taskId"
              class="bg-secondary rounded-lg p-3 text-xs"
            >
              <div class="flex items-center justify-between mb-1">
                <span class="text-muted-foreground font-mono truncate max-w-xs">{{ taskId }}</span>
                <span class="text-foreground font-semibold">最终分：{{ result.finalScore }}</span>
              </div>
              <div class="flex gap-4 text-muted-foreground">
                <span>投票：{{ result.voteCount }}</span>
                <span class="text-green-400">认可：{{ result.approvalCount }}</span>
                <span class="text-red-400">挑战：{{ result.challengeCount }}</span>
                <span>中位数：{{ result.medianScore }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
