<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { bulletinApi, type AuditTrailEntry } from '@/services/bulletin';
import { adminApi, type AdminUser } from '@/services/admin';
import { ChevronDown, ChevronRight, Filter } from 'lucide-vue-next';

const logs = ref<AuditTrailEntry[]>([]);
const users = ref<AdminUser[]>([]);
const total = ref(0);
const loading = ref(true);
const error = ref('');
const expandedIds = ref<Set<string>>(new Set());

// 筛选器
const filterActor = ref('');
const filterAction = ref('');
const filterResource = ref('');
const currentPage = ref(1);
const PAGE_SIZE = 30;

const ACTION_OPTIONS = ['create', 'update', 'delete', 'approve', 'reject', 'trigger', 'close'];

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await bulletinApi.getAuditTrail({ page: currentPage.value, limit: PAGE_SIZE });
    logs.value = res.data.data;
    total.value = res.data.meta.total;
  } catch (e) {
    error.value = '加载审计日志失败';
  } finally {
    loading.value = false;
  }
}

async function loadUsers() {
  try {
    users.value = await adminApi.listUsers();
  } catch {
    // non-critical
  }
}

const filteredLogs = computed(() => {
  return logs.value.filter((l) => {
    if (filterActor.value && !l.actorName.includes(filterActor.value)) return false;
    if (filterAction.value && l.action !== filterAction.value) return false;
    if (filterResource.value && l.resource !== filterResource.value) return false;
    return true;
  });
});

const uniqueResources = computed(() => {
  return [...new Set(logs.value.map((l) => l.resource))].sort();
});

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id);
  } else {
    expandedIds.value.add(id);
  }
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    create: '创建', update: '更新', delete: '删除',
    approve: '批准', reject: '拒绝', trigger: '触发', close: '关闭',
  };
  return map[action] ?? action;
}

function actionClass(action: string): string {
  if (action === 'create') return 'text-green-400 bg-green-400/10';
  if (action === 'delete') return 'text-destructive bg-destructive/10';
  if (action === 'approve') return 'text-primary bg-primary/10';
  return 'text-muted-foreground bg-secondary';
}

onMounted(async () => {
  await Promise.all([load(), loadUsers()]);
});
</script>

<template>
  <div>
    <h2 class="text-base font-semibold text-foreground mb-1">审计日志</h2>
    <p class="text-sm text-muted-foreground mb-5">所有管理操作的完整记录（共 {{ total }} 条）</p>

    <!-- 筛选器 -->
    <div class="glass-card p-4 mb-4">
      <div class="flex items-center gap-2 mb-3">
        <Filter class="w-4 h-4 text-muted-foreground" />
        <span class="text-xs font-medium text-muted-foreground">筛选条件</span>
      </div>
      <div class="grid grid-cols-3 gap-3">
        <!-- 操作人 -->
        <div>
          <label class="text-xs text-muted-foreground block mb-1">操作人</label>
          <input
            v-model="filterActor"
            type="text"
            placeholder="搜索姓名..."
            class="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <!-- 操作类型 -->
        <div>
          <label class="text-xs text-muted-foreground block mb-1">操作类型</label>
          <select
            v-model="filterAction"
            class="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">全部操作</option>
            <option v-for="action in ACTION_OPTIONS" :key="action" :value="action">
              {{ actionLabel(action) }}
            </option>
          </select>
        </div>
        <!-- 资源类型 -->
        <div>
          <label class="text-xs text-muted-foreground block mb-1">资源</label>
          <select
            v-model="filterResource"
            class="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">全部资源</option>
            <option v-for="r in uniqueResources" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 8" :key="i" class="h-12 bg-secondary rounded-lg animate-pulse" />
    </div>
    <div v-else-if="error" class="text-center py-8 text-muted-foreground text-sm">{{ error }}</div>
    <div v-else-if="filteredLogs.length === 0" class="text-center py-8 text-muted-foreground text-sm">
      暂无日志记录
    </div>

    <div v-else class="space-y-1.5">
      <div v-for="log in filteredLogs" :key="log.id" class="glass-card overflow-hidden">
        <!-- 主行 -->
        <button
          class="w-full p-3 text-left flex items-center gap-3"
          @click="toggleExpand(log.id)"
        >
          <component
            :is="expandedIds.has(log.id) ? ChevronDown : ChevronRight"
            class="w-3.5 h-3.5 text-muted-foreground shrink-0"
          />
          <div class="flex-1 grid grid-cols-4 gap-2 items-center min-w-0">
            <span class="text-xs text-foreground font-medium truncate">{{ log.actorName }}</span>
            <span class="text-xs px-1.5 py-0.5 rounded text-center font-medium w-fit" :class="actionClass(log.action)">
              {{ actionLabel(log.action) }}
            </span>
            <span class="text-xs text-muted-foreground truncate">{{ log.resource }}</span>
            <span class="text-xs text-muted-foreground text-right">
              {{ new Date(log.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }}
            </span>
          </div>
        </button>

        <!-- JSON diff -->
        <div v-if="expandedIds.has(log.id)" class="border-t border-border">
          <div class="px-4 pt-3 pb-1">
            <p class="text-xs text-muted-foreground">
              资源 ID：<span class="text-foreground font-mono">{{ log.resourceId ?? '—' }}</span>
            </p>
          </div>
          <div class="grid grid-cols-2 divide-x divide-border">
            <div class="p-3">
              <p class="text-xs text-muted-foreground mb-1.5 font-medium">变更前</p>
              <pre class="text-xs text-foreground/70 overflow-x-auto whitespace-pre-wrap break-all max-h-48">{{ log.previousData ? JSON.stringify(log.previousData, null, 2) : '—' }}</pre>
            </div>
            <div class="p-3">
              <p class="text-xs text-muted-foreground mb-1.5 font-medium">变更后</p>
              <pre class="text-xs text-foreground/70 overflow-x-auto whitespace-pre-wrap break-all max-h-48">{{ log.newData ? JSON.stringify(log.newData, null, 2) : '—' }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
