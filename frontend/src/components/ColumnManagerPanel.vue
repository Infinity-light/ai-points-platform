<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { customFieldsApi, type FieldDef } from '@/services/custom-fields';

const props = defineProps<{
  projectId: string;
  open: boolean;
  isProjectLead: boolean;
}>();

const emit = defineEmits<{
  'update:open': [val: boolean];
  'fields-updated': [fields: FieldDef[]];
}>();

// ─── 固定列（只读展示）──────────────────────────────────────────────────────
const FIXED_COLUMNS = [
  { name: '标题', type: '文本' },
  { name: '状态', type: '枚举' },
  { name: '负责人', type: '成员' },
  { name: '优先级', type: '枚举' },
  { name: '标签', type: '多选' },
  { name: '截止日期', type: '日期' },
  { name: 'AI 评分', type: '数字' },
  { name: '最终工分', type: '数字' },
  { name: '创建时间', type: '日期' },
];

const TYPE_LABELS: Record<FieldDef['type'], string> = {
  text: '文本',
  number: '数字',
  date: '日期',
  single_select: '单选',
  multi_select: '多选',
};

// ─── 状态 ──────────────────────────────────────────────────────────────────
const fields = ref<FieldDef[]>([]);
const loadError = ref('');
const saving = ref(false);
const saveError = ref('');

// 新增列表单
const showAddForm = ref(false);
const newName = ref('');
const newType = ref<FieldDef['type']>('text');
const newOptions = ref('');
const addError = ref('');

// ─── 加载 ──────────────────────────────────────────────────────────────────
async function load() {
  loadError.value = '';
  try {
    const res = await customFieldsApi.get(props.projectId);
    fields.value = res.data;
  } catch {
    loadError.value = '加载自定义列失败';
  }
}

onMounted(load);
watch(() => props.projectId, load);

// ─── 删除列 ────────────────────────────────────────────────────────────────
async function removeField(key: string) {
  const updated = fields.value.filter((f) => f.key !== key);
  await save(updated);
}

// ─── 添加列 ────────────────────────────────────────────────────────────────
function openAddForm() {
  newName.value = '';
  newType.value = 'text';
  newOptions.value = '';
  addError.value = '';
  showAddForm.value = true;
}

function cancelAdd() {
  showAddForm.value = false;
}

async function confirmAdd() {
  addError.value = '';
  if (!newName.value.trim()) {
    addError.value = '列名不能为空';
    return;
  }
  const key = `cf_${Date.now()}`;
  const options =
    (newType.value === 'single_select' || newType.value === 'multi_select')
      ? newOptions.value.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined;

  const newField: FieldDef = {
    key,
    name: newName.value.trim(),
    type: newType.value,
    options,
    order: fields.value.length,
  };
  const updated = [...fields.value, newField];
  const ok = await save(updated);
  if (ok) {
    showAddForm.value = false;
  }
}

// ─── 保存 ──────────────────────────────────────────────────────────────────
async function save(updated: FieldDef[]): Promise<boolean> {
  saving.value = true;
  saveError.value = '';
  try {
    const res = await customFieldsApi.update(props.projectId, updated);
    fields.value = res.data;
    emit('fields-updated', res.data);
    return true;
  } catch {
    saveError.value = '保存失败，请重试';
    return false;
  } finally {
    saving.value = false;
  }
}

function close() {
  emit('update:open', false);
}
</script>

<template>
  <!-- Overlay -->
  <Transition name="overlay">
    <div v-if="open" class="panel-overlay" @click="close" />
  </Transition>

  <!-- Drawer -->
  <Transition name="drawer">
    <div v-if="open" class="column-panel">
      <!-- Header -->
      <div class="panel-header">
        <span class="panel-title">列管理</span>
        <button class="panel-close" @click="close" title="关闭">✕</button>
      </div>

      <!-- Error -->
      <div v-if="loadError" class="panel-error">{{ loadError }}</div>

      <!-- Fixed columns section -->
      <div class="section-label">系统列（不可删除）</div>
      <ul class="col-list">
        <li v-for="col in FIXED_COLUMNS" :key="col.name" class="col-item col-item--fixed">
          <span class="col-name">{{ col.name }}</span>
          <span class="col-type-badge">{{ col.type }}</span>
        </li>
      </ul>

      <!-- Custom columns section -->
      <div class="section-label section-label--space">
        自定义列
        <span class="col-count">{{ fields.length }}</span>
      </div>

      <ul v-if="fields.length" class="col-list">
        <li v-for="field in fields" :key="field.key" class="col-item">
          <span class="col-name">{{ field.name }}</span>
          <span class="col-type-badge">{{ TYPE_LABELS[field.type] }}</span>
          <button
            v-if="isProjectLead"
            class="col-delete"
            :disabled="saving"
            title="删除"
            @click="removeField(field.key)"
          >✕</button>
        </li>
      </ul>
      <div v-else class="empty-hint">暂无自定义列</div>

      <!-- Save error -->
      <div v-if="saveError" class="panel-error">{{ saveError }}</div>

      <!-- Add form -->
      <div v-if="isProjectLead">
        <div v-if="showAddForm" class="add-form">
          <div class="form-row">
            <label class="form-label">列名</label>
            <input
              v-model="newName"
              class="form-input"
              placeholder="例：需求来源"
              maxlength="30"
            />
          </div>
          <div class="form-row">
            <label class="form-label">类型</label>
            <select v-model="newType" class="form-select">
              <option value="text">文本</option>
              <option value="number">数字</option>
              <option value="date">日期</option>
              <option value="single_select">单选</option>
              <option value="multi_select">多选</option>
            </select>
          </div>
          <div v-if="newType === 'single_select' || newType === 'multi_select'" class="form-row">
            <label class="form-label">选项</label>
            <input
              v-model="newOptions"
              class="form-input"
              placeholder="用逗号分隔，如：A,B,C"
            />
          </div>
          <div v-if="addError" class="form-error">{{ addError }}</div>
          <div class="form-actions">
            <button class="btn-cancel" @click="cancelAdd">取消</button>
            <button class="btn-confirm" :disabled="saving" @click="confirmAdd">
              {{ saving ? '保存中...' : '确认添加' }}
            </button>
          </div>
        </div>

        <button v-else class="btn-add" :disabled="saving" @click="openAddForm">
          + 添加列
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 40;
}

.column-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 320px;
  background: hsl(var(--card));
  border-left: 1px solid hsl(var(--border));
  z-index: 50;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 0 0 1.5rem;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid hsl(var(--border));
  position: sticky;
  top: 0;
  background: hsl(var(--card));
  z-index: 1;
}

.panel-title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.panel-close {
  background: none;
  border: none;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-size: 1rem;
  padding: 0.25rem;
  line-height: 1;
  border-radius: 0.25rem;
  transition: color 0.15s;
}
.panel-close:hover { color: hsl(var(--foreground)); }

.panel-error {
  margin: 0.75rem 1.25rem;
  padding: 0.5rem 0.75rem;
  background: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
  border-radius: 0.375rem;
  font-size: 0.8125rem;
}

.section-label {
  padding: 0.75rem 1.25rem 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: hsl(var(--muted-foreground));
}
.section-label--space { margin-top: 0.5rem; }

.col-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.25rem;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 500;
  margin-left: 0.375rem;
}

.col-list {
  list-style: none;
  margin: 0;
  padding: 0 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.col-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4375rem 0.625rem;
  border-radius: 0.375rem;
  background: hsl(var(--muted) / 0.4);
}
.col-item--fixed {
  opacity: 0.7;
}

.col-name {
  flex: 1;
  font-size: 0.875rem;
  color: hsl(var(--foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-type-badge {
  font-size: 0.6875rem;
  padding: 0.0625rem 0.375rem;
  border-radius: 9999px;
  background: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  flex-shrink: 0;
}

.col-delete {
  background: none;
  border: none;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  flex-shrink: 0;
  transition: color 0.15s, background 0.15s;
}
.col-delete:hover {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 0.1);
}
.col-delete:disabled { opacity: 0.4; cursor: not-allowed; }

.empty-hint {
  padding: 0.75rem 1.25rem;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  font-style: italic;
}

/* Add form */
.btn-add {
  margin: 1rem 1.25rem 0;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4375rem 0.875rem;
  border: 1px dashed hsl(var(--border));
  border-radius: 0.375rem;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  width: calc(100% - 2.5rem);
  justify-content: center;
}
.btn-add:hover {
  color: hsl(var(--primary));
  border-color: hsl(var(--primary) / 0.5);
}
.btn-add:disabled { opacity: 0.5; cursor: not-allowed; }

.add-form {
  margin: 0.75rem 1.25rem 0;
  padding: 0.875rem;
  background: hsl(var(--muted) / 0.5);
  border: 1px solid hsl(var(--border));
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.form-input,
.form-select {
  padding: 0.375rem 0.625rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.form-input:focus,
.form-select:focus { border-color: hsl(var(--primary) / 0.6); }

.form-error {
  font-size: 0.8125rem;
  color: hsl(var(--destructive));
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.25rem;
}

.btn-cancel {
  padding: 0.375rem 0.75rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.375rem;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  cursor: pointer;
  transition: color 0.15s;
}
.btn-cancel:hover { color: hsl(var(--foreground)); }

.btn-confirm {
  padding: 0.375rem 0.875rem;
  border: none;
  border-radius: 0.375rem;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font-size: 0.875rem;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-confirm:hover { opacity: 0.9; }
.btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

/* Transitions */
.overlay-enter-active,
.overlay-leave-active { transition: opacity 0.2s; }
.overlay-enter-from,
.overlay-leave-to { opacity: 0; }

.drawer-enter-active,
.drawer-leave-active { transition: transform 0.25s ease; }
.drawer-enter-from,
.drawer-leave-to { transform: translateX(100%); }
</style>
