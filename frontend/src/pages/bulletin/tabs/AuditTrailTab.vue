<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { bulletinApi, type AuditTrailEntry } from '@/services/bulletin';
import { ChevronDown, ChevronRight, Shield } from 'lucide-vue-next';

const logs = ref<AuditTrailEntry[]>([]);
const total = ref(0);
const loading = ref(true);
const error = ref('');
const expandedIds = ref<Set<string>>(new Set());

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await bulletinApi.getAuditTrail({ page: 1, limit: 30 });
    logs.value = res.data.data;
    total.value = res.data.meta.total;
  } catch (e) {
    error.value = '加载审计日志失败';
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

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    create: '创建',
    update: '更新',
    delete: '删除',
    approve: '批准',
    reject: '拒绝',
    trigger: '触发',
    close: '关闭',
  };
  return map[action] ?? action;
}

function actionClass(action: string): string {
  if (action === 'create') return 'text-green-400 bg-green-400/10';
  if (action === 'delete') return 'text-destructive bg-destructive/10';
  if (action === 'approve') return 'text-primary bg-primary/10';
  return 'text-muted-foreground bg-secondary';
}

function naturalLanguage(log: AuditTrailEntry): string {
  return `${log.actorName} 对 ${log.resource}${log.resourceId ? `（${log.resourceId.slice(0, 8)}…）` : ''} 执行了 ${actionLabel(log.action)} 操作`;
}

onMounted(load);
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-sm font-medium text-foreground flex items-center gap-1.5">
        <Shield class="w-4 h-4" />
        操作日志（共 {{ total }} 条）
      </h2>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 6" :key="i" class="h-12 bg-secondary rounded-lg animate-pulse" />
    </div>
    <div v-else-if="error" class="text-center py-8 text-muted-foreground text-sm">{{ error }}</div>
    <div v-else-if="logs.length === 0" class="text-center py-8 text-muted-foreground text-sm">
      暂无审计日志
    </div>

    <div v-else class="space-y-1.5">
      <div v-for="log in logs" :key="log.id" class="glass-card overflow-hidden">
        <!-- 主行 -->
        <button
          class="w-full p-3 text-left flex items-center gap-3"
          :class="(log.previousData || log.newData) ? 'cursor-pointer' : 'cursor-default'"
          @click="(log.previousData || log.newData) && toggleExpand(log.id)"
        >
          <component
            v-if="log.previousData || log.newData"
            :is="expandedIds.has(log.id) ? ChevronDown : ChevronRight"
            class="w-3.5 h-3.5 text-muted-foreground shrink-0"
          />
          <div v-else class="w-3.5 h-3.5 shrink-0" />

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-xs px-1.5 py-0.5 rounded font-medium" :class="actionClass(log.action)">
                {{ actionLabel(log.action) }}
              </span>
              <p class="text-xs text-foreground truncate">{{ naturalLanguage(log) }}</p>
            </div>
          </div>
          <p class="text-xs text-muted-foreground shrink-0">
            {{ new Date(log.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
          </p>
        </button>

        <!-- 展开：JSON diff -->
        <div v-if="expandedIds.has(log.id)" class="border-t border-border">
          <div class="grid grid-cols-2 divide-x divide-border">
            <div class="p-3">
              <p class="text-xs text-muted-foreground mb-1.5">变更前</p>
              <pre class="text-xs text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all">{{ log.previousData ? JSON.stringify(log.previousData, null, 2) : '—' }}</pre>
            </div>
            <div class="p-3">
              <p class="text-xs text-muted-foreground mb-1.5">变更后</p>
              <pre class="text-xs text-foreground/80 overflow-x-auto whitespace-pre-wrap break-all">{{ log.newData ? JSON.stringify(log.newData, null, 2) : '—' }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
