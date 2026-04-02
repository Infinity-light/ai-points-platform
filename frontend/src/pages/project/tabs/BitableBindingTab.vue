<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  bitableApi,
  getFeishuTableUrl,
  type BitableBinding,
  type BitableField,
  type BitableFieldMapping,
} from '@/services/bitable';
import { RefreshCw, Trash2, Link, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-vue-next';

// ─── Props ────────────────────────────────────────────────────────────────────

const props = defineProps<{ projectId: string }>();

// ─── State ────────────────────────────────────────────────────────────────────

type ViewMode = 'loading' | 'setup' | 'dashboard' | 'error';

const viewMode = ref<ViewMode>('loading');
const loadError = ref('');

// Setup form
const formAppToken = ref('');
const formTableId = ref('');
const fieldsLoading = ref(false);
const fieldsError = ref('');
const availableFields = ref<BitableField[]>([]);
const fieldMapping = ref<BitableFieldMapping>({
  title: '',
  assignees: '',
  status: '',
  description: '',
  attachments: '',
});
const writebackFieldId = ref('');
const saving = ref(false);
const saveError = ref('');

// Dashboard
const binding = ref<BitableBinding | null>(null);
const syncTriggering = ref(false);
const syncError = ref('');
const deleteConfirmVisible = ref(false);
const deleting = ref(false);

// ─── Platform field definitions ───────────────────────────────────────────────

const platformFields: Array<{ key: keyof BitableFieldMapping; label: string }> = [
  { key: 'title', label: '标题' },
  { key: 'assignees', label: '负责人' },
  { key: 'status', label: '状态' },
  { key: 'description', label: '工作成果说明' },
  { key: 'attachments', label: '附件' },
];

// ─── Init ─────────────────────────────────────────────────────────────────────

async function loadBinding() {
  viewMode.value = 'loading';
  loadError.value = '';
  try {
    const data = await bitableApi.getBinding(props.projectId);
    if (data) {
      binding.value = data;
      viewMode.value = 'dashboard';
    } else {
      viewMode.value = 'setup';
    }
  } catch {
    loadError.value = '加载绑定信息失败，请刷新重试';
    viewMode.value = 'error';
  }
}

onMounted(() => {
  void loadBinding();
});

// ─── Setup: fetch fields ──────────────────────────────────────────────────────

async function fetchFields() {
  if (!formAppToken.value.trim() || !formTableId.value.trim()) return;
  fieldsLoading.value = true;
  fieldsError.value = '';
  availableFields.value = [];
  try {
    const res = await bitableApi.fetchFields(
      props.projectId,
      formAppToken.value.trim(),
      formTableId.value.trim(),
    );
    availableFields.value = res.fields;
  } catch {
    fieldsError.value = '获取字段失败，请检查 App Token 和 Table ID 是否正确';
  } finally {
    fieldsLoading.value = false;
  }
}

// ─── Setup: save binding ──────────────────────────────────────────────────────

async function saveBinding() {
  saving.value = true;
  saveError.value = '';
  try {
    const cleanMapping: BitableFieldMapping = {};
    for (const pf of platformFields) {
      const val = fieldMapping.value[pf.key];
      if (val) cleanMapping[pf.key] = val;
    }
    const data = await bitableApi.createBinding(props.projectId, {
      appToken: formAppToken.value.trim(),
      tableId: formTableId.value.trim(),
      fieldMapping: cleanMapping,
      writebackFieldId: writebackFieldId.value,
    });
    binding.value = data;
    viewMode.value = 'dashboard';
  } catch {
    saveError.value = '保存失败，请重试';
  } finally {
    saving.value = false;
  }
}

// ─── Dashboard: trigger sync ─────────────────────────────────────────────────

async function triggerSync() {
  syncTriggering.value = true;
  syncError.value = '';
  try {
    await bitableApi.triggerSync(props.projectId);
    // Refresh binding to get updated sync status
    const updated = await bitableApi.getBinding(props.projectId);
    if (updated) binding.value = updated;
  } catch {
    syncError.value = '触发同步失败，请重试';
  } finally {
    syncTriggering.value = false;
  }
}

// ─── Dashboard: delete binding ────────────────────────────────────────────────

async function confirmDelete() {
  deleting.value = true;
  try {
    await bitableApi.deleteBinding(props.projectId);
    binding.value = null;
    // Reset setup form
    formAppToken.value = '';
    formTableId.value = '';
    availableFields.value = [];
    fieldMapping.value = { title: '', assignees: '', status: '', description: '', attachments: '' };
    writebackFieldId.value = '';
    viewMode.value = 'setup';
  } catch {
    syncError.value = '解除绑定失败，请重试';
  } finally {
    deleting.value = false;
    deleteConfirmVisible.value = false;
  }
}

// ─── Computed ─────────────────────────────────────────────────────────────────

const feishuEmbedUrl = computed(() => {
  if (!binding.value) return '';
  return getFeishuTableUrl(binding.value);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<template>
  <div>
    <!-- ── Loading ──────────────────────────────────────────────────────────── -->
    <div v-if="viewMode === 'loading'" class="flex items-center justify-center py-20">
      <Loader2 class="w-6 h-6 text-muted-foreground animate-spin" />
    </div>

    <!-- ── Error ────────────────────────────────────────────────────────────── -->
    <div
      v-else-if="viewMode === 'error'"
      class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg flex items-center gap-2"
    >
      <AlertCircle class="w-4 h-4 shrink-0" />
      {{ loadError }}
      <button
        class="ml-auto text-xs underline hover:no-underline cursor-pointer"
        @click="loadBinding"
      >
        重试
      </button>
    </div>

    <!-- ── Setup Form ────────────────────────────────────────────────────────── -->
    <div v-else-if="viewMode === 'setup'" class="max-w-2xl">
      <div class="flex items-center gap-2 mb-5">
        <Link class="w-5 h-5 text-muted-foreground" />
        <div>
          <h3 class="text-sm font-semibold text-foreground">绑定飞书多维表格</h3>
          <p class="text-xs text-muted-foreground mt-0.5">
            将项目任务与飞书多维表格同步，实现双向数据流
          </p>
        </div>
      </div>

      <!-- Step 1: Token + Table ID -->
      <div class="glass-card p-4 mb-4 space-y-3">
        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          步骤 1 — 填写表格信息
        </p>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">App Token</label>
          <input
            v-model="formAppToken"
            type="text"
            placeholder="bascn..."
            class="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p class="text-xs text-muted-foreground mt-1">从飞书多维表格 URL 中获取，格式：bascn...</p>
        </div>
        <div>
          <label class="block text-xs font-medium text-muted-foreground mb-1">Table ID</label>
          <input
            v-model="formTableId"
            type="text"
            placeholder="tblXXXXXXXX"
            class="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p class="text-xs text-muted-foreground mt-1">从飞书多维表格 URL 中获取，格式：tblXXXX</p>
        </div>
        <div class="flex items-center gap-2 pt-1">
          <button
            class="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!formAppToken.trim() || !formTableId.trim() || fieldsLoading"
            @click="fetchFields"
          >
            <Loader2 v-if="fieldsLoading" class="w-3.5 h-3.5 animate-spin" />
            <RefreshCw v-else class="w-3.5 h-3.5" />
            获取字段
          </button>
          <span v-if="availableFields.length > 0" class="text-xs text-green-400 flex items-center gap-1">
            <CheckCircle2 class="w-3.5 h-3.5" />
            已获取 {{ availableFields.length }} 个字段
          </span>
        </div>
        <p v-if="fieldsError" class="text-xs text-destructive">{{ fieldsError }}</p>
      </div>

      <!-- Step 2: Field mapping (shown after fields are fetched) -->
      <div v-if="availableFields.length > 0" class="glass-card p-4 mb-4 space-y-3">
        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          步骤 2 — 配置字段映射
        </p>
        <p class="text-xs text-muted-foreground">
          选择飞书表格中与平台字段对应的列（可跳过不需要同步的字段）
        </p>

        <div class="space-y-2.5">
          <div
            v-for="pf in platformFields"
            :key="pf.key"
            class="grid grid-cols-2 gap-3 items-center"
          >
            <span class="text-sm text-foreground font-medium">{{ pf.label }}</span>
            <select
              v-model="fieldMapping[pf.key]"
              class="w-full px-3 py-1.5 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
            >
              <option value="">— 不映射 —</option>
              <option
                v-for="field in availableFields"
                :key="field.fieldId"
                :value="field.fieldId"
              >
                {{ field.fieldName }}
              </option>
            </select>
          </div>
        </div>

        <div class="border-t border-border pt-3 mt-2">
          <label class="block text-xs font-medium text-muted-foreground mb-1">
            最终工分回写列
            <span class="text-muted-foreground font-normal ml-1">（任务结算后自动写回）</span>
          </label>
          <select
            v-model="writebackFieldId"
            class="w-full px-3 py-1.5 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            <option value="">— 不回写 —</option>
            <option
              v-for="field in availableFields"
              :key="field.fieldId"
              :value="field.fieldId"
            >
              {{ field.fieldName }}
            </option>
          </select>
        </div>

        <p v-if="saveError" class="text-xs text-destructive">{{ saveError }}</p>

        <div class="flex justify-end pt-1">
          <button
            class="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="saving"
            @click="saveBinding"
          >
            <Loader2 v-if="saving" class="w-3.5 h-3.5 animate-spin" />
            保存并同步
          </button>
        </div>
      </div>
    </div>

    <!-- ── Dashboard ─────────────────────────────────────────────────────────── -->
    <div v-else-if="viewMode === 'dashboard' && binding" class="space-y-4">
      <!-- Binding info card -->
      <div class="glass-card p-4 max-w-2xl">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Link class="w-4 h-4 text-primary" />
            <h3 class="text-sm font-semibold text-foreground">飞书多维表格绑定</h3>
            <span
              v-if="binding.appToken"
              class="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded"
            >
              平台自动创建
            </span>
          </div>
          <!-- Sync status badge -->
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
            :class="{
              'bg-green-500/10 text-green-400': binding.syncStatus === 'idle',
              'bg-yellow-500/10 text-yellow-400': binding.syncStatus === 'syncing',
              'bg-destructive/10 text-destructive': binding.syncStatus === 'error',
            }"
          >
            <CheckCircle2 v-if="binding.syncStatus === 'idle'" class="w-3 h-3" />
            <Loader2 v-else-if="binding.syncStatus === 'syncing'" class="w-3 h-3 animate-spin" />
            <AlertCircle v-else class="w-3 h-3" />
            {{
              binding.syncStatus === 'idle'
                ? '空闲'
                : binding.syncStatus === 'syncing'
                ? '同步中'
                : '错误'
            }}
          </span>
        </div>

        <div class="space-y-2 text-sm">
          <div class="flex items-start gap-2">
            <span class="text-muted-foreground w-24 shrink-0">App Token</span>
            <span class="font-mono text-xs text-foreground bg-secondary px-2 py-0.5 rounded break-all">
              {{ binding.appToken }}
            </span>
          </div>
          <div class="flex items-start gap-2">
            <span class="text-muted-foreground w-24 shrink-0">Table ID</span>
            <span class="font-mono text-xs text-foreground bg-secondary px-2 py-0.5 rounded">
              {{ binding.tableId }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-muted-foreground w-24 shrink-0">上次同步</span>
            <span class="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock class="w-3.5 h-3.5" />
              {{ formatDateTime(binding.lastSyncAt) }}
            </span>
          </div>
          <div v-if="binding.syncStatus === 'error' && binding.lastSyncError" class="flex items-start gap-2">
            <span class="text-muted-foreground w-24 shrink-0">错误详情</span>
            <span class="text-xs text-destructive">{{ binding.lastSyncError }}</span>
          </div>
        </div>
      </div>

      <!-- Field mapping summary -->
      <div class="glass-card p-4 max-w-2xl">
        <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">字段映射</p>
        <div class="space-y-1.5 text-sm">
          <div
            v-for="pf in platformFields"
            :key="pf.key"
            class="flex items-center gap-2"
          >
            <span class="text-muted-foreground w-32 shrink-0">{{ pf.label }}</span>
            <span
              v-if="binding.fieldMapping[pf.key]"
              class="font-mono text-xs bg-secondary px-2 py-0.5 rounded text-foreground"
            >
              {{ binding.fieldMapping[pf.key] }}
            </span>
            <span v-else class="text-xs text-muted-foreground">— 未映射 —</span>
          </div>
          <div class="flex items-center gap-2 pt-1.5 border-t border-border mt-1.5">
            <span class="text-muted-foreground w-32 shrink-0">工分回写列</span>
            <span
              v-if="binding.writebackFieldId"
              class="font-mono text-xs bg-secondary px-2 py-0.5 rounded text-foreground"
            >
              {{ binding.writebackFieldId }}
            </span>
            <span v-else class="text-xs text-muted-foreground">— 不回写 —</span>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2 max-w-2xl">
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="syncTriggering"
          @click="triggerSync"
        >
          <Loader2 v-if="syncTriggering" class="w-3.5 h-3.5 animate-spin" />
          <RefreshCw v-else class="w-3.5 h-3.5" />
          手动同步
        </button>
        <button
          class="flex items-center gap-1.5 px-3 py-1.5 border border-border text-muted-foreground rounded-lg text-sm font-medium hover:text-destructive hover:border-destructive transition-colors cursor-pointer"
          @click="deleteConfirmVisible = true"
        >
          <Trash2 class="w-3.5 h-3.5" />
          解除绑定
        </button>
      </div>

      <p v-if="syncError" class="text-xs text-destructive max-w-2xl">{{ syncError }}</p>

      <!-- Feishu table live embed -->
      <div class="mt-2">
        <h3 class="text-sm font-semibold text-foreground mb-3">飞书表格实时视图</h3>
        <div class="rounded-lg overflow-hidden border border-border" style="height: 600px;">
          <iframe
            :src="feishuEmbedUrl"
            class="w-full h-full border-0"
            allow="clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>
      </div>
    </div>

    <!-- ── Delete confirm modal ───────────────────────────────────────────────── -->
    <div
      v-if="deleteConfirmVisible"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      @click.self="deleteConfirmVisible = false"
    >
      <div class="glass-card shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 class="font-heading font-semibold text-foreground mb-2">解除绑定</h3>
        <p class="text-sm text-muted-foreground mb-5">
          确认解除与飞书多维表格的绑定？已同步的数据不会被删除，但后续将不再自动同步。
        </p>
        <div class="flex gap-2">
          <button
            class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium hover:bg-destructive/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="deleting"
            @click="confirmDelete"
          >
            <Loader2 v-if="deleting" class="w-3.5 h-3.5 animate-spin" />
            确认解除
          </button>
          <button
            class="flex-1 px-3 py-2 border border-border text-foreground rounded-lg text-sm font-medium hover:bg-secondary transition-colors cursor-pointer"
            @click="deleteConfirmVisible = false"
          >
            取消
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
