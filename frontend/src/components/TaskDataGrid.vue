<script setup lang="ts">
import { ref, computed } from 'vue';
import type { VxeTableInstance, VxeTableDefines } from 'vxe-table';
import { taskApi, type Task, type TaskStatus } from '@/services/task';

export interface Member {
  id: string;
  name: string;
}

const props = defineProps<{
  tasks: Task[];
  loading: boolean;
  projectId: string;
  members: Member[];
  customColumns?: CustomColumn[];
}>();

export interface CustomColumn {
  key: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'single_select' | 'multi_select';
  options?: string[];
  order: number;
}

const emit = defineEmits<{
  'update:task': [task: Task];
  'create:task': [task: Task];
  'select:task': [task: Task];
  'submit:task': [task: Task];
}>();

const tableRef = ref<VxeTableInstance<Task>>();

// ─── 状态映射 ────────────────────────────────────────────────────────────────
const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  open: { label: '待认领', color: '#8b8fa8' },
  claimed: { label: '进行中', color: '#6366f1' },
  submitted: { label: '已提交', color: '#eab308' },
  ai_reviewing: { label: 'AI审中', color: '#06b6d4' },
  pending_review: { label: '待评审', color: '#3b82f6' },
  pending_vote: { label: '待投票', color: '#a855f7' },
  settled: { label: '已固化', color: '#22c55e' },
  cancelled: { label: '已取消', color: '#ef4444' },
};

const priorityOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
];

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: '低', color: '#8b8fa8' },
  medium: { label: '中', color: '#eab308' },
  high: { label: '高', color: '#ef4444' },
};

// ─── 成员查询 ────────────────────────────────────────────────────────────────
function getMemberName(userId: string | null): string {
  if (!userId) return '—';
  return props.members.find((m) => m.id === userId)?.name ?? '—';
}

// ─── 行内编辑保存 ────────────────────────────────────────────────────────────
async function onEditClosed(params: VxeTableDefines.EditClosedEventParams<Task>) {
  const { row, column } = params;
  const field = column.field as string;

  // Build update payload based on which field changed
  let payload: Record<string, unknown> = {};

  if (field === 'title') {
    payload = { title: row.title };
  } else if (field === 'metadata.priority') {
    payload = { metadata: { ...row.metadata, priority: row.metadata?.priority } };
  } else if (field === 'metadata.deadline') {
    payload = { metadata: { ...row.metadata, deadline: row.metadata?.deadline } };
  } else if (field.startsWith('metadata.')) {
    // Custom column field
    const key = field.replace('metadata.', '');
    payload = { metadata: { ...row.metadata, [key]: (row.metadata as Record<string, unknown>)?.[key] } };
  } else {
    return;
  }

  try {
    const res = await taskApi.update(props.projectId, row.id, payload);
    emit('update:task', res.data);
  } catch {
    // Rollback: reload original row from keepSource
    await tableRef.value?.reloadRow(row, null);
    saveError.value = '保存失败，已回滚';
    setTimeout(() => { saveError.value = ''; }, 3000);
  }
}

const saveError = ref('');

// ─── 行点击 → select:task ────────────────────────────────────────────────────
function onRowClick(params: { row: Task }) {
  emit('select:task', params.row);
}

// ─── 底部新建行 ──────────────────────────────────────────────────────────────
const newTaskTitle = ref('');
const creating = ref(false);

async function handleCreateTask() {
  const title = newTaskTitle.value.trim();
  if (!title || creating.value) return;
  creating.value = true;
  try {
    const res = await taskApi.create(props.projectId, { title });
    emit('create:task', res.data);
    newTaskTitle.value = '';
  } finally {
    creating.value = false;
  }
}

function onNewRowKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleCreateTask();
  }
}

// ─── 日期格式化 ──────────────────────────────────────────────────────────────
function formatDate(val: string | undefined | null): string {
  if (!val) return '—';
  return val.slice(0, 10);
}

// ─── 自定义列编辑器配置 ──────────────────────────────────────────────────────
function customColEditRender(col: CustomColumn) {
  if (col.type === 'single_select') {
    return {
      name: 'select',
      options: (col.options ?? []).map((o) => ({ label: o, value: o })),
      optionProps: { label: 'label', value: 'value' },
    };
  }
  if (col.type === 'number') {
    return { name: 'input', attrs: { type: 'number' } };
  }
  if (col.type === 'date') {
    return { name: 'input', attrs: { type: 'date' } };
  }
  if (col.type === 'multi_select') {
    // multi_select: read-only display, no inline editor
    return null;
  }
  // text
  return { name: 'input' };
}

const tableData = computed(() => props.tasks);
</script>

<template>
  <div class="task-data-grid">
    <!-- 错误提示 -->
    <div v-if="saveError" class="save-error-toast">{{ saveError }}</div>

    <vxe-table
      ref="tableRef"
      :data="tableData"
      :loading="loading"
      keep-source
      height="auto"
      max-height="600"
      :edit-config="{ trigger: 'click', mode: 'cell', showStatus: true }"
      :sort-config="{ trigger: 'cell', remote: false }"
      :row-config="{ isHover: true, isCurrent: true }"
      :virtual-y-config="{ enabled: true, gt: 50 }"
      :scroll-y="{ enabled: true }"
      border="inner"
      stripe
      show-overflow
      @edit-closed="onEditClosed"
      @cell-click="onRowClick"
    >
      <!-- 标题列 -->
      <vxe-column
        field="title"
        title="标题"
        min-width="200"
        :edit-render="{ name: 'input', attrs: { placeholder: '任务标题' } }"
        sortable
      >
        <template #default="{ row }">
          <span class="cell-title">{{ row.title }}</span>
        </template>
      </vxe-column>

      <!-- 状态列 -->
      <vxe-column field="status" title="状态" width="110" sortable>
        <template #default="{ row }">
          <span
            class="status-badge"
            :style="{ color: statusConfig[row.status as TaskStatus]?.color ?? '#8b8fa8' }"
          >
            <span
              class="status-dot"
              :style="{ background: statusConfig[row.status as TaskStatus]?.color ?? '#8b8fa8' }"
            />
            {{ statusConfig[row.status as TaskStatus]?.label ?? row.status }}
          </span>
        </template>
      </vxe-column>

      <!-- 负责人列 -->
      <vxe-column field="assigneeId" title="负责人" width="120">
        <template #default="{ row }">
          <span class="cell-muted">{{ getMemberName(row.assigneeId) }}</span>
        </template>
      </vxe-column>

      <!-- 优先级列 -->
      <vxe-column
        field="metadata.priority"
        title="优先级"
        width="100"
        :edit-render="{
          name: 'select',
          options: priorityOptions,
          optionProps: { label: 'label', value: 'value' },
        }"
        sortable
      >
        <template #default="{ row }">
          <span
            v-if="row.metadata?.priority"
            class="priority-badge"
            :style="{ color: priorityConfig[row.metadata.priority]?.color }"
          >
            {{ priorityConfig[row.metadata.priority]?.label ?? row.metadata.priority }}
          </span>
          <span v-else class="cell-muted">—</span>
        </template>
      </vxe-column>

      <!-- 标签列 -->
      <vxe-column field="metadata.tags" title="标签" width="160">
        <template #default="{ row }">
          <span v-if="row.metadata?.tags?.length" class="tags-cell">
            <span
              v-for="tag in (row.metadata.tags as string[])"
              :key="tag"
              class="tag-chip"
            >{{ tag }}</span>
          </span>
          <span v-else class="cell-muted">—</span>
        </template>
      </vxe-column>

      <!-- 截止日期列 -->
      <vxe-column
        field="metadata.deadline"
        title="截止日期"
        width="130"
        :edit-render="{ name: 'input', attrs: { type: 'date' } }"
        sortable
      >
        <template #default="{ row }">
          <span class="cell-muted">{{ formatDate(row.metadata?.deadline as string | null) }}</span>
        </template>
      </vxe-column>

      <!-- AI 评分列 -->
      <vxe-column field="metadata.aiScores" title="AI评分" width="90" align="center">
        <template #default="{ row }">
          <span v-if="row.metadata?.aiScores?.average != null" class="cell-number">
            {{ (row.metadata.aiScores as { average: number }).average.toFixed(1) }}
          </span>
          <span v-else class="cell-muted">—</span>
        </template>
      </vxe-column>

      <!-- 最终工分列 -->
      <vxe-column field="metadata.finalPoints" title="最终工分" width="90" align="center">
        <template #default="{ row }">
          <span v-if="row.metadata?.finalPoints != null" class="cell-number font-medium">
            {{ row.metadata.finalPoints }}
          </span>
          <span v-else class="cell-muted">—</span>
        </template>
      </vxe-column>

      <!-- 创建时间列 -->
      <vxe-column field="createdAt" title="创建时间" width="120" sortable>
        <template #default="{ row }">
          <span class="cell-muted">{{ formatDate(row.createdAt) }}</span>
        </template>
      </vxe-column>

      <!-- 动态自定义列 -->
      <template v-if="customColumns?.length">
        <vxe-column
          v-for="col in customColumns"
          :key="col.key"
          :field="`metadata.${col.key}`"
          :title="col.name"
          width="140"
          v-bind="customColEditRender(col) ? { 'edit-render': customColEditRender(col) } : {}"
        >
          <template #default="{ row }">
            <span v-if="col.type === 'multi_select'" class="tags-cell">
              <template v-if="Array.isArray((row.metadata as Record<string, unknown>)?.[col.key])">
                <span
                  v-for="v in ((row.metadata as Record<string, unknown>)[col.key] as string[])"
                  :key="v"
                  class="tag-chip"
                >{{ v }}</span>
              </template>
              <span v-else class="cell-muted">—</span>
            </span>
            <span v-else class="cell-muted">
              {{ (row.metadata as Record<string, unknown>)?.[col.key] ?? '—' }}
            </span>
          </template>
        </vxe-column>
      </template>
    </vxe-table>

    <!-- 底部新建行 -->
    <div class="new-task-row">
      <span class="new-task-plus">+</span>
      <input
        v-model="newTaskTitle"
        class="new-task-input"
        placeholder="新建任务..."
        :disabled="creating"
        @keydown="onNewRowKeydown"
        @blur="handleCreateTask"
      />
      <span v-if="creating" class="new-task-loading">创建中...</span>
    </div>
  </div>
</template>

<style scoped>
.task-data-grid {
  position: relative;
  width: 100%;
}

.save-error-toast {
  position: absolute;
  top: -2rem;
  right: 0;
  background: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.8125rem;
  z-index: 10;
}

/* Status badge */
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  font-weight: 500;
}

.status-dot {
  display: inline-block;
  width: 0.4375rem;
  height: 0.4375rem;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Priority badge */
.priority-badge {
  font-size: 0.8125rem;
  font-weight: 500;
}

/* Tags */
.tags-cell {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.tag-chip {
  display: inline-block;
  padding: 0.0625rem 0.375rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  background: hsl(var(--primary) / 0.12);
  color: hsl(var(--primary));
  border: 1px solid hsl(var(--primary) / 0.25);
  white-space: nowrap;
}

/* Cell helpers */
.cell-title {
  font-weight: 500;
  color: hsl(var(--foreground));
}

.cell-muted {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.cell-number {
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.875rem;
  color: hsl(var(--foreground));
}

/* New task row */
.new-task-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid hsl(var(--border));
  border-top: none;
  background: hsl(var(--card));
  border-radius: 0 0 0.375rem 0.375rem;
}

.new-task-plus {
  color: hsl(var(--muted-foreground));
  font-size: 1rem;
  line-height: 1;
  flex-shrink: 0;
}

.new-task-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-family: inherit;
}

.new-task-input::placeholder {
  color: hsl(var(--muted-foreground));
}

.new-task-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.new-task-loading {
  font-size: 0.8125rem;
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
}
</style>
