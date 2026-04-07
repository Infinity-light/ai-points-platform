<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { assetApi, type AssetOperation } from '@/services/asset';

const props = defineProps<{ assetId: string }>();

const operations = ref<AssetOperation[]>([]);
const loading = ref(true);
const error = ref('');

const operationLabels: Record<string, string> = {
  assign: '分配',
  return: '归还',
  transfer: '转移',
  repair: '送修',
  loan: '借出',
  dispose: '处置',
  accept: '验收入库',
};

const operationColors: Record<string, string> = {
  assign: 'text-green-400 bg-green-400/10',
  return: 'text-blue-400 bg-blue-400/10',
  transfer: 'text-purple-400 bg-purple-400/10',
  repair: 'text-amber-400 bg-amber-400/10',
  loan: 'text-cyan-400 bg-cyan-400/10',
  dispose: 'text-red-400 bg-red-400/10',
  accept: 'text-primary bg-primary/10',
};

function formatDate(date: string): string {
  return new Date(date).toLocaleString('zh-CN');
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await assetApi.getOperations(props.assetId);
    operations.value = [...data].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch {
    error.value = '加载操作记录失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-20 bg-secondary rounded-xl animate-pulse" />
    </div>

    <div v-else-if="error" class="text-center py-8 text-red-400 text-sm">{{ error }}</div>

    <div v-else-if="operations.length === 0" class="text-center py-12 text-muted-foreground text-sm">
      暂无操作记录
    </div>

    <div v-else class="relative">
      <!-- Timeline line -->
      <div class="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

      <div class="space-y-4">
        <div
          v-for="op in operations"
          :key="op.id"
          class="relative flex gap-4 pl-10"
        >
          <!-- Dot -->
          <div class="absolute left-3.5 top-3 w-3 h-3 rounded-full border-2 border-border bg-background" />

          <div class="glass-card flex-1 p-4">
            <div class="flex items-start justify-between gap-3 mb-2">
              <span
                class="px-2 py-0.5 rounded text-xs font-medium"
                :class="operationColors[op.operationType] ?? 'text-muted-foreground bg-secondary'"
              >
                {{ operationLabels[op.operationType] ?? op.operationType }}
              </span>
              <span class="text-xs text-muted-foreground whitespace-nowrap">{{ formatDate(op.createdAt) }}</span>
            </div>

            <div class="text-xs text-muted-foreground space-y-1">
              <div v-if="op.fromUserId">
                从：<span class="text-foreground font-mono">{{ op.fromUserId.slice(0, 8) }}...</span>
              </div>
              <div v-if="op.toUserId">
                至：<span class="text-foreground font-mono">{{ op.toUserId.slice(0, 8) }}...</span>
              </div>
              <div>操作人：<span class="text-foreground font-mono">{{ op.operatedBy.slice(0, 8) }}...</span></div>
              <div v-if="op.notes" class="text-foreground mt-1">{{ op.notes }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
