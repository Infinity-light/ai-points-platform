<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { bitableSyncApi, type BitableBinding, type BitableSyncLog } from '@/services/bitable-sync';
import { RefreshCw, Trash2, FileText, Plus, X } from 'lucide-vue-next';

const bindings = ref<BitableBinding[]>([]);
const loading = ref(true);
const error = ref('');

// Create binding modal
const showCreateModal = ref(false);
const createLoading = ref(false);
const createError = ref('');
const createForm = ref({
  appToken: '',
  tableId: '',
  entityType: 'task',
  syncDirection: 'bidirectional',
  conflictStrategy: 'platform_wins',
  projectId: '',
});

// Sync logs modal
const showLogsModal = ref(false);
const logsLoading = ref(false);
const logsError = ref('');
const selectedBindingId = ref('');
const logs = ref<BitableSyncLog[]>([]);

// Syncing state per binding
const syncing = ref<Set<string>>(new Set());
const deleting = ref<Set<string>>(new Set());

async function load() {
  loading.value = true;
  error.value = '';
  try {
    bindings.value = await bitableSyncApi.listBindings();
  } catch {
    error.value = '加载同步绑定列表失败';
  } finally {
    loading.value = false;
  }
}

async function triggerSync(id: string) {
  syncing.value.add(id);
  try {
    await bitableSyncApi.triggerSync(id);
    await load();
  } catch {
    error.value = '触发同步失败';
  } finally {
    syncing.value.delete(id);
  }
}

async function deleteBinding(id: string) {
  if (!confirm('确定要删除此同步绑定吗？')) return;
  deleting.value.add(id);
  try {
    await bitableSyncApi.deleteBinding(id);
    bindings.value = bindings.value.filter((b) => b.id !== id);
  } catch {
    error.value = '删除失败';
  } finally {
    deleting.value.delete(id);
  }
}

async function openLogs(id: string) {
  selectedBindingId.value = id;
  showLogsModal.value = true;
  logsLoading.value = true;
  logsError.value = '';
  try {
    logs.value = await bitableSyncApi.getLogs(id);
  } catch {
    logsError.value = '加载同步日志失败';
  } finally {
    logsLoading.value = false;
  }
}

function openCreateModal() {
  createForm.value = {
    appToken: '',
    tableId: '',
    entityType: 'task',
    syncDirection: 'bidirectional',
    conflictStrategy: 'platform_wins',
    projectId: '',
  };
  createError.value = '';
  showCreateModal.value = true;
}

async function submitCreate() {
  if (!createForm.value.appToken.trim() || !createForm.value.tableId.trim()) {
    createError.value = '请填写 AppToken 和 TableId';
    return;
  }
  createLoading.value = true;
  createError.value = '';
  try {
    await bitableSyncApi.createBinding({ ...createForm.value });
    showCreateModal.value = false;
    await load();
  } catch {
    createError.value = '创建失败，请检查配置';
  } finally {
    createLoading.value = false;
  }
}

function syncStatusClass(status: string): string {
  if (status === 'success') return 'text-green-400 bg-green-400/10';
  if (status === 'running') return 'text-blue-400 bg-blue-400/10';
  if (status === 'error') return 'text-red-400 bg-red-400/10';
  return 'text-muted-foreground bg-secondary';
}

function syncStatusLabel(status: string): string {
  const map: Record<string, string> = {
    success: '成功',
    running: '同步中',
    error: '失败',
    idle: '空闲',
    pending: '待同步',
  };
  return map[status] ?? status;
}

function logStatusClass(status: string): string {
  if (status === 'success') return 'text-green-400';
  if (status === 'failed') return 'text-red-400';
  if (status === 'running') return 'text-blue-400';
  return 'text-muted-foreground';
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('zh-CN');
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-heading font-semibold text-foreground">飞书同步中心</h3>
        <p class="text-sm text-muted-foreground">管理飞书 Bitable 双向数据同步绑定</p>
      </div>
      <button
        class="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150"
        @click="openCreateModal"
      >
        <Plus class="w-4 h-4" />
        新建绑定
      </button>
    </div>

    <div v-if="error" class="text-sm text-red-400 bg-red-400/10 rounded-lg px-4 py-2">{{ error }}</div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-16 bg-secondary rounded-xl animate-pulse" />
    </div>

    <div
      v-else-if="bindings.length === 0"
      class="text-center py-12 text-muted-foreground text-sm"
    >
      暂无同步绑定，点击「新建绑定」开始配置
    </div>

    <div v-else class="overflow-hidden rounded-xl border border-border">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-secondary/50 border-b border-border">
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">实体类型</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">项目 ID</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">同步方向</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">同步状态</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">最后同步</th>
            <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
            <th class="px-4 py-3 text-right text-xs font-medium text-muted-foreground">操作</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-border">
          <tr
            v-for="binding in bindings"
            :key="binding.id"
            class="hover:bg-secondary/20 transition-colors"
          >
            <td class="px-4 py-3 text-foreground font-medium">{{ binding.entityType }}</td>
            <td class="px-4 py-3 text-muted-foreground font-mono text-xs">
              {{ binding.projectId ? binding.projectId.slice(0, 8) + '...' : '—' }}
            </td>
            <td class="px-4 py-3 text-muted-foreground">{{ binding.syncDirection }}</td>
            <td class="px-4 py-3">
              <span
                class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="syncStatusClass(binding.syncStatus)"
              >
                {{ syncStatusLabel(binding.syncStatus) }}
              </span>
            </td>
            <td class="px-4 py-3 text-muted-foreground text-xs">
              {{ formatDate(binding.lastSyncAt) }}
            </td>
            <td class="px-4 py-3">
              <span
                class="px-2 py-0.5 rounded-full text-xs font-medium"
                :class="binding.isActive ? 'text-green-400 bg-green-400/10' : 'text-muted-foreground bg-secondary'"
              >
                {{ binding.isActive ? '启用' : '停用' }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex items-center justify-end gap-1">
                <button
                  :disabled="syncing.has(binding.id)"
                  class="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                  title="触发全量同步"
                  @click="triggerSync(binding.id)"
                >
                  <RefreshCw class="w-3.5 h-3.5" :class="syncing.has(binding.id) ? 'animate-spin' : ''" />
                </button>
                <button
                  class="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                  title="查看同步日志"
                  @click="openLogs(binding.id)"
                >
                  <FileText class="w-3.5 h-3.5" />
                </button>
                <button
                  :disabled="deleting.has(binding.id)"
                  class="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors text-muted-foreground hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="删除绑定"
                  @click="deleteBinding(binding.id)"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create binding modal -->
    <Teleport to="body">
      <div
        v-if="showCreateModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="showCreateModal = false"
      >
        <div class="glass-card w-full max-w-lg p-6 shadow-2xl">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-heading font-semibold text-foreground">新建同步绑定</h2>
            <button
              class="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              @click="showCreateModal = false"
            >
              <X class="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs text-muted-foreground mb-1.5">AppToken</label>
              <input
                v-model="createForm.appToken"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                placeholder="飞书 Bitable AppToken"
              />
            </div>
            <div>
              <label class="block text-xs text-muted-foreground mb-1.5">TableId</label>
              <input
                v-model="createForm.tableId"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                placeholder="飞书 Bitable TableId"
              />
            </div>
            <div>
              <label class="block text-xs text-muted-foreground mb-1.5">项目 ID（可选）</label>
              <input
                v-model="createForm.projectId"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                placeholder="关联的项目 UUID"
              />
            </div>
            <div>
              <label class="block text-xs text-muted-foreground mb-1.5">实体类型</label>
              <select
                v-model="createForm.entityType"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              >
                <option value="task">任务</option>
                <option value="member">成员</option>
                <option value="points">工分</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-muted-foreground mb-1.5">同步方向</label>
              <select
                v-model="createForm.syncDirection"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              >
                <option value="bidirectional">双向</option>
                <option value="platform_to_feishu">平台 → 飞书</option>
                <option value="feishu_to_platform">飞书 → 平台</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-muted-foreground mb-1.5">冲突策略</label>
              <select
                v-model="createForm.conflictStrategy"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              >
                <option value="platform_wins">平台优先</option>
                <option value="feishu_wins">飞书优先</option>
                <option value="latest_wins">最新时间优先</option>
              </select>
            </div>
          </div>

          <p v-if="createError" class="text-xs text-destructive mt-3">{{ createError }}</p>

          <div class="flex gap-2 justify-end mt-5">
            <button
              class="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-white/5 transition-colors duration-150"
              @click="showCreateModal = false"
            >
              取消
            </button>
            <button
              class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="createLoading"
              @click="submitCreate"
            >
              {{ createLoading ? '创建中...' : '创建绑定' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Logs modal -->
    <Teleport to="body">
      <div
        v-if="showLogsModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="showLogsModal = false"
      >
        <div class="glass-card w-full max-w-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-heading font-semibold text-foreground">同步日志</h2>
            <button
              class="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              @click="showLogsModal = false"
            >
              <X class="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div class="flex-1 overflow-y-auto">
            <div v-if="logsLoading" class="space-y-3">
              <div v-for="i in 4" :key="i" class="h-14 bg-secondary rounded-lg animate-pulse" />
            </div>
            <div v-else-if="logsError" class="text-center py-8 text-red-400 text-sm">{{ logsError }}</div>
            <div v-else-if="logs.length === 0" class="text-center py-8 text-muted-foreground text-sm">
              暂无同步日志
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="log in logs"
                :key="log.id"
                class="bg-secondary/30 rounded-lg px-4 py-3 text-xs"
              >
                <div class="flex items-center justify-between mb-1">
                  <div class="flex items-center gap-2">
                    <span :class="['font-medium', logStatusClass(log.status)]">
                      {{ log.status === 'success' ? '成功' : log.status === 'failed' ? '失败' : log.status }}
                    </span>
                    <span class="text-muted-foreground">{{ log.syncType }} · {{ log.direction }}</span>
                  </div>
                  <span class="text-muted-foreground">{{ formatDate(log.startedAt) }}</span>
                </div>
                <div class="flex gap-4 text-muted-foreground">
                  <span>处理 {{ log.recordsProcessed }}</span>
                  <span class="text-green-400">新增 {{ log.recordsCreated }}</span>
                  <span class="text-blue-400">更新 {{ log.recordsUpdated }}</span>
                  <span v-if="log.recordsFailed > 0" class="text-red-400">失败 {{ log.recordsFailed }}</span>
                </div>
                <p v-if="log.errorMessage" class="text-red-400 mt-1">{{ log.errorMessage }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
