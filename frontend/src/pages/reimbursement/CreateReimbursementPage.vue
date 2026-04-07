<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { reimbursementApi } from '@/services/reimbursement';
import { ChevronLeft, Plus, Trash2 } from 'lucide-vue-next';

const router = useRouter();

type Step = 1 | 2 | 3;
const currentStep = ref<Step>(1);

// Step 1: 基本信息
const stepOneForm = ref({
  title: '',
  reimbursementType: 'general',
  notes: '',
  linkedAssetId: '',
});

// Step 2: 报销明细
interface ItemForm {
  description: string;
  amount: string;
  expenseDate: string;
}

const items = ref<ItemForm[]>([
  { description: '', amount: '', expenseDate: '' },
]);

// Step 3: 提交
const submitting = ref(false);
const submitError = ref('');

const totalAmount = computed(() =>
  items.value.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
);

const stepOneValid = computed(
  () => stepOneForm.value.title.trim().length > 0,
);

const stepTwoValid = computed(
  () =>
    items.value.length > 0 &&
    items.value.every(
      (item) => item.description.trim() && parseFloat(item.amount) > 0 && item.expenseDate,
    ),
);

function addItem() {
  items.value.push({ description: '', amount: '', expenseDate: '' });
}

function removeItem(index: number) {
  if (items.value.length > 1) {
    items.value.splice(index, 1);
  }
}

function goToStep(step: Step) {
  if (step === 2 && !stepOneValid.value) return;
  if (step === 3 && !stepTwoValid.value) return;
  currentStep.value = step;
}

async function saveOrSubmit(shouldSubmit: boolean) {
  submitting.value = true;
  submitError.value = '';
  try {
    const payload = {
      title: stepOneForm.value.title.trim(),
      reimbursementType: stepOneForm.value.reimbursementType,
      notes: stepOneForm.value.notes.trim() || undefined,
      linkedAssetId: stepOneForm.value.linkedAssetId.trim() || undefined,
      items: items.value.map((item) => ({
        description: item.description.trim(),
        amount: parseFloat(item.amount),
        expenseDate: item.expenseDate,
        receiptUploadIds: [],
      })),
    };
    const created = await reimbursementApi.create(payload);
    if (shouldSubmit) {
      await reimbursementApi.submit(created.id);
    }
    router.push(`/reimbursements/${created.id}`);
  } catch {
    submitError.value = '提交失败，请重试';
  } finally {
    submitting.value = false;
  }
}

const reimbursementTypes = [
  { value: 'general', label: '日常报销' },
  { value: 'travel', label: '差旅报销' },
  { value: 'asset_purchase', label: '资产采购' },
  { value: 'entertainment', label: '业务招待' },
  { value: 'other', label: '其他' },
];
</script>

<template>
  <div class="p-6 max-w-2xl mx-auto">
    <!-- 返回 + 标题 -->
    <div class="mb-6">
      <button
        class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        @click="router.push('/reimbursements')"
      >
        <ChevronLeft class="w-4 h-4" />
        返回报销列表
      </button>
      <h1 class="text-2xl font-heading font-bold text-foreground">新建报销</h1>
    </div>

    <!-- 步骤指示器 -->
    <div class="flex items-center gap-2 mb-8">
      <div
        v-for="(label, idx) in ['基本信息', '报销明细', '确认提交']"
        :key="idx"
        class="flex items-center gap-2"
      >
        <div
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors"
          :class="currentStep > idx + 1
            ? 'bg-primary text-primary-foreground'
            : currentStep === idx + 1
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-muted-foreground'"
        >
          {{ idx + 1 }}
        </div>
        <span
          class="text-sm transition-colors"
          :class="currentStep === idx + 1 ? 'text-foreground font-medium' : 'text-muted-foreground'"
        >
          {{ label }}
        </span>
        <div v-if="idx < 2" class="h-px w-8 bg-border" />
      </div>
    </div>

    <!-- Step 1: 基本信息 -->
    <div v-if="currentStep === 1" class="glass-card p-6 space-y-4">
      <h3 class="text-base font-medium text-foreground">基本信息</h3>

      <div>
        <label class="block text-xs text-muted-foreground mb-1.5">报销标题 *</label>
        <input
          v-model="stepOneForm.title"
          class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          placeholder="简要描述报销内容"
        />
      </div>

      <div>
        <label class="block text-xs text-muted-foreground mb-1.5">报销类型</label>
        <select
          v-model="stepOneForm.reimbursementType"
          class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
        >
          <option v-for="t in reimbursementTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </div>

      <div>
        <label class="block text-xs text-muted-foreground mb-1.5">关联资产 ID（可选）</label>
        <input
          v-model="stepOneForm.linkedAssetId"
          class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          placeholder="关联的资产 UUID（如资产采购报销）"
        />
      </div>

      <div>
        <label class="block text-xs text-muted-foreground mb-1.5">备注</label>
        <textarea
          v-model="stepOneForm.notes"
          rows="3"
          class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
          placeholder="补充说明..."
        />
      </div>

      <div class="flex justify-end">
        <button
          class="px-5 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!stepOneValid"
          @click="goToStep(2)"
        >
          下一步：添加明细
        </button>
      </div>
    </div>

    <!-- Step 2: 报销明细 -->
    <div v-else-if="currentStep === 2" class="glass-card p-6 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="text-base font-medium text-foreground">报销明细</h3>
        <button
          class="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          @click="addItem"
        >
          <Plus class="w-3.5 h-3.5" />
          添加明细
        </button>
      </div>

      <div class="space-y-3">
        <div
          v-for="(item, idx) in items"
          :key="idx"
          class="bg-secondary/30 rounded-lg p-4 space-y-3"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground">明细 {{ idx + 1 }}</span>
            <button
              v-if="items.length > 1"
              class="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
              @click="removeItem(idx)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <label class="block text-xs text-muted-foreground mb-1">描述 *</label>
            <input
              v-model="item.description"
              class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder="费用描述"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-muted-foreground mb-1">金额（元）*</label>
              <input
                v-model="item.amount"
                type="number"
                min="0"
                step="0.01"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                placeholder="0.00"
              />
            </div>
            <div>
              <label class="block text-xs text-muted-foreground mb-1">消费日期 *</label>
              <input
                v-model="item.expenseDate"
                type="date"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 合计 -->
      <div class="flex justify-between items-center border-t border-border pt-4">
        <span class="text-sm text-muted-foreground">报销总计</span>
        <span class="text-lg font-heading font-bold text-primary">¥{{ totalAmount.toFixed(2) }}</span>
      </div>

      <div class="flex justify-between">
        <button
          class="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-white/5 transition-colors duration-150"
          @click="goToStep(1)"
        >
          上一步
        </button>
        <button
          class="px-5 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!stepTwoValid"
          @click="goToStep(3)"
        >
          下一步：确认提交
        </button>
      </div>
    </div>

    <!-- Step 3: 确认提交 -->
    <div v-else-if="currentStep === 3" class="glass-card p-6 space-y-5">
      <h3 class="text-base font-medium text-foreground">确认提交</h3>

      <!-- 汇总信息 -->
      <div class="bg-secondary/30 rounded-lg p-4 space-y-2 text-sm">
        <div class="flex justify-between">
          <span class="text-muted-foreground">标题</span>
          <span class="text-foreground font-medium">{{ stepOneForm.title }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">类型</span>
          <span class="text-foreground">{{ stepOneForm.reimbursementType }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">明细条数</span>
          <span class="text-foreground">{{ items.length }} 条</span>
        </div>
        <div class="flex justify-between border-t border-border pt-2 mt-1">
          <span class="text-muted-foreground font-medium">报销总额</span>
          <span class="text-primary font-heading font-bold text-lg">¥{{ totalAmount.toFixed(2) }}</span>
        </div>
      </div>

      <p v-if="submitError" class="text-xs text-destructive">{{ submitError }}</p>

      <div class="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <button
          class="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-white/5 transition-colors duration-150"
          :disabled="submitting"
          @click="goToStep(2)"
        >
          上一步
        </button>
        <div class="flex gap-2">
          <button
            class="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-white/5 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="submitting"
            @click="saveOrSubmit(false)"
          >
            {{ submitting ? '保存中...' : '保存草稿' }}
          </button>
          <button
            class="px-5 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="submitting"
            @click="saveOrSubmit(true)"
          >
            {{ submitting ? '提交中...' : '提交审批' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
