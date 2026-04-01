<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { bulletinApi, type LeaderboardResult } from '@/services/bulletin';
import { Trophy, RefreshCw } from 'lucide-vue-next';

const result = ref<LeaderboardResult | null>(null);
const loading = ref(true);
const error = ref('');
const projectId = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await bulletinApi.getLeaderboard(projectId.value ? { projectId: projectId.value } : undefined);
    result.value = res.data;
  } catch (e) {
    error.value = '加载排行榜失败';
  } finally {
    loading.value = false;
  }
}

function rankMedal(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

onMounted(load);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-medium text-foreground">工分排行榜</h2>
      <button
        class="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
        :class="{ 'animate-spin': loading }"
        :disabled="loading"
        @click="load"
      >
        <RefreshCw class="w-4 h-4" />
      </button>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 5" :key="i" class="h-12 bg-secondary rounded-lg animate-pulse" />
    </div>

    <div v-else-if="error" class="text-center py-8 text-muted-foreground text-sm">{{ error }}</div>

    <div v-else-if="!result?.entries.length" class="text-center py-8 text-muted-foreground text-sm">
      <Trophy class="w-8 h-8 mx-auto mb-2 opacity-40" />
      暂无排行数据，请先完成结算
    </div>

    <template v-else>
      <p v-if="result.snapshotAt" class="text-xs text-muted-foreground mb-3">
        快照时间：{{ new Date(result.snapshotAt).toLocaleString('zh-CN') }}
      </p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border">
              <th class="pb-2 text-left text-xs text-muted-foreground font-medium w-12">排名</th>
              <th class="pb-2 text-left text-xs text-muted-foreground font-medium">成员</th>
              <th class="pb-2 text-right text-xs text-muted-foreground font-medium">原始工分</th>
              <th class="pb-2 text-right text-xs text-muted-foreground font-medium">活跃工分</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="entry in result.entries"
              :key="entry.userId || entry.rank"
              class="border-b border-border/50 last:border-0"
            >
              <td class="py-2.5 text-sm font-medium" :class="entry.rank <= 3 ? 'text-lg' : 'text-muted-foreground'">
                {{ rankMedal(entry.rank) }}
              </td>
              <td class="py-2.5 text-foreground font-medium">{{ entry.userName }}</td>
              <td class="py-2.5 text-right text-muted-foreground">{{ entry.rawPoints }}</td>
              <td class="py-2.5 text-right text-primary font-semibold">{{ entry.activePoints }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
