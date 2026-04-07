<script setup lang="ts">
import { ref, computed } from 'vue';
import { assetApi, type Asset } from '@/services/asset';
import { Save, X } from 'lucide-vue-next';

const props = defineProps<{ asset: Asset }>();
const emit = defineEmits<{ (e: 'updated', asset: Asset): void }>();

const saving = ref(false);
const saveError = ref('');
const saveSuccess = ref(false);

const showOperationModal = ref(false);
const operationLoading = ref(false);
const operationError = ref('');
const operationForm = ref({
  operationType: 'assign',
  toUserId: '',
  notes: '',
});

const form = ref({
  name: props.asset.name,
  category: props.asset.category,
  vendor: props.asset.vendor ?? '',
  serialNumber: props.asset.serialNumber ?? '',
  purchasePrice: props.asset.purchasePrice?.toString() ?? '',
  usefulLifeMonths: props.asset.usefulLifeMonths?.toString() ?? '',
  residualValue: props.asset.residualValue?.toString() ?? '',
  purchaseDate: props.asset.purchaseDate?.slice(0, 10) ?? '',
  expiresAt: props.asset.expiresAt?.slice(0, 10) ?? '',
  notes: props.asset.notes ?? '',
});

const availableOperations = computed(() => {
  const status = props.asset.status;
  const ops: { value: string; label: string }[] = [];
  if (status === 'in_stock') {
    ops.push({ value: 'assign', label: '分配给用户' });
    ops.push({ value: 'dispose', label: '处置' });
  }
  if (status === 'in_use') {
    ops.push({ value: 'return', label: '归还' });
    ops.push({ value: 'transfer', label: '转移' });
    ops.push({ value: 'repair', label: '送修' });
    ops.push({ value: 'loan', label: '借出' });
    ops.push({ value: 'dispose', label: '处置' });
  }
  if (status === 'loaned') {
    ops.push({ value: 'return', label: '归还' });
  }
  if (status === 'under_repair') {
    ops.push({ value: 'return', label: '维修完成归还' });
  }
  return ops;
});

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    in_stock: '库存',
    in_use: '使用中',
    under_repair: '维修中',
    loaned: '借出',
    disposed: '已处置',
    expired: '已过期',
  };
  return map[status] ?? status;
}

function statusClass(status: string): string {
  const map: Record<string, string> = {
    in_stock: 'text-blue-400 bg-blue-400/10',
    in_use: 'text-green-400 bg-green-400/10',
    under_repair: 'text-amber-400 bg-amber-400/10',
    loaned: 'text-purple-400 bg-purple-400/10',
    disposed: 'text-muted-foreground bg-secondary',
    expired: 'text-red-400 bg-red-400/10',
  };
  return map[status] ?? 'text-muted-foreground bg-secondary';
}

async function save() {
  saving.value = true;
  saveError.value = '';
  saveSuccess.value = false;
  try {
    const updated = await assetApi.update(props.asset.id, {
      name: form.value.name.trim(),
      category: form.value.category.trim(),
      vendor: form.value.vendor.trim() || undefined,
      serialNumber: form.value.serialNumber.trim() || undefined,
      purchasePrice: form.value.purchasePrice ? Number(form.value.purchasePrice) : undefined,
      usefulLifeMonths: form.value.usefulLifeMonths ? Number(form.value.usefulLifeMonths) : undefined,
      residualValue: form.value.residualValue ? Number(form.value.residualValue) : undefined,
      purchaseDate: form.value.purchaseDate || undefined,
      expiresAt: form.value.expiresAt || undefined,
      notes: form.value.notes.trim() || undefined,
    });
    saveSuccess.value = true;
    emit('updated', updated);
    setTimeout(() => { saveSuccess.value = false; }, 2000);
  } catch {
    saveError.value = '保存失败，请重试';
  } finally {
    saving.value = false;
  }
}

function openOperationModal(opType: string) {
  operationForm.value = { operationType: opType, toUserId: '', notes: '' };
  operationError.value = '';
  showOperationModal.value = true;
}

async function submitOperation() {
  operationLoading.value = true;
  operationError.value = '';
  try {
    await assetApi.executeOperation(props.asset.id, {
      operationType: operationForm.value.operationType,
      toUserId: operationForm.value.toUserId.trim() || undefined,
      notes: operationForm.value.notes.trim() || undefined,
    });
    showOperationModal.value = false;
    // Reload asset after operation
    const updated = await assetApi.get(props.asset.id);
    emit('updated', updated);
  } catch {
    operationError.value = '操作失败，请重试';
  } finally {
    operationLoading.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <!-- 状态 + 操作 -->
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-2">
        <span class="text-sm text-muted-foreground">当前状态：</span>
        <span class="px-2.5 py-1 rounded-full text-xs font-medium" :class="statusClass(asset.status)">
          {{ statusLabel(asset.status) }}
        </span>
      </div>
      <div v-if="availableOperations.length > 0" class="flex flex-wrap gap-2">
        <button
          v-for="op in availableOperations"
          :key="op.value"
          class="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150"
          @click="openOperationModal(op.value)"
        >
          {{ op.label }}
        </button>
      </div>
    </div>

    <!-- 基本信息表单 -->
    <div class="glass-card p-5 space-y-4">
      <h4 class="text-sm font-medium text-foreground border-b border-border pb-3">基本信息</h4>

      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">资产名称</label>
          <input
            v-model="form.name"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">分类</label>
          <input
            v-model="form.category"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">供应商</label>
          <input
            v-model="form.vendor"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            placeholder="—"
          />
        </div>
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">序列号</label>
          <input
            v-model="form.serialNumber"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            placeholder="—"
          />
        </div>
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">采购价格（元）</label>
          <input
            v-model="form.purchasePrice"
            type="number"
            min="0"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">采购日期</label>
          <input
            v-model="form.purchaseDate"
            type="date"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">使用寿命（月）</label>
          <input
            v-model="form.usefulLifeMonths"
            type="number"
            min="0"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">残值（元）</label>
          <input
            v-model="form.residualValue"
            type="number"
            min="0"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">到期日</label>
          <input
            v-model="form.expiresAt"
            type="date"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">资产编号</label>
          <input
            :value="asset.assetCode"
            disabled
            class="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground cursor-not-allowed font-mono"
          />
        </div>
      </div>

      <div>
        <label class="block text-xs text-muted-foreground mb-1.5">备注</label>
        <textarea
          v-model="form.notes"
          rows="3"
          class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
          placeholder="补充说明..."
        />
      </div>

      <p v-if="saveError" class="text-xs text-destructive">{{ saveError }}</p>
      <p v-if="saveSuccess" class="text-xs text-green-400">保存成功</p>

      <div class="flex justify-end">
        <button
          class="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="saving"
          @click="save"
        >
          <Save class="w-4 h-4" />
          {{ saving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>

    <!-- 操作模态框 -->
    <Teleport to="body">
      <div
        v-if="showOperationModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="showOperationModal = false"
      >
        <div class="glass-card w-full max-w-md p-6 shadow-2xl">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-heading font-semibold text-foreground">资产操作</h2>
            <button
              class="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              @click="showOperationModal = false"
            >
              <X class="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs text-muted-foreground mb-1.5">操作类型</label>
              <input
                :value="operationForm.operationType"
                disabled
                class="w-full bg-secondary/30 border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>
            <div v-if="['assign', 'transfer', 'loan'].includes(operationForm.operationType)">
              <label class="block text-xs text-muted-foreground mb-1.5">目标用户 ID</label>
              <input
                v-model="operationForm.toUserId"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                placeholder="目标用户 UUID"
              />
            </div>
            <div>
              <label class="block text-xs text-muted-foreground mb-1.5">备注</label>
              <textarea
                v-model="operationForm.notes"
                rows="2"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                placeholder="操作说明..."
              />
            </div>
          </div>

          <p v-if="operationError" class="text-xs text-destructive mt-3">{{ operationError }}</p>

          <div class="flex gap-2 justify-end mt-5">
            <button
              class="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-white/5 transition-colors duration-150"
              @click="showOperationModal = false"
            >
              取消
            </button>
            <button
              class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="operationLoading"
              @click="submitOperation"
            >
              {{ operationLoading ? '执行中...' : '确认执行' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
