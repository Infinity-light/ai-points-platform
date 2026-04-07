<script setup lang="ts">
import { ref, computed } from 'vue';
import { reimbursementApi, type Reimbursement, type ReimbursementItem } from '@/services/reimbursement';
import { Save, Plus, Trash2 } from 'lucide-vue-next';

const props = defineProps<{ reimbursement: Reimbursement }>();
const emit = defineEmits<{ (e: 'updated', r: Reimbursement): void }>();

const isDraft = computed(() => props.reimbursement.status === 'draft');

interface EditableItem extends Omit<ReimbursementItem, 'amount'> {
  amount: string;
}

const editableItems = ref<EditableItem[]>(
  props.reimbursement.items.map((item) => ({
    ...item,
    amount: item.amount.toString(),
  })),
);

const saving = ref(false);
const saveError = ref('');
const saveSuccess = ref(false);

const totalAmount = computed(() =>
  editableItems.value.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
);

function addItem() {
  editableItems.value.push({
    id: '',
    description: '',
    amount: '',
    expenseDate: '',
    receiptUploadIds: [],
  });
}

function removeItem(index: number) {
  if (editableItems.value.length > 1) {
    editableItems.value.splice(index, 1);
  }
}

async function save() {
  saving.value = true;
  saveError.value = '';
  saveSuccess.value = false;
  try {
    const updated = await reimbursementApi.update(props.reimbursement.id, {
      items: editableItems.value.map((item) => ({
        description: item.description.trim(),
        amount: parseFloat(item.amount),
        expenseDate: item.expenseDate,
        receiptUploadIds: item.receiptUploadIds,
      })),
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
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h4 class="text-sm font-medium text-foreground">报销明细</h4>
      <button
        v-if="isDraft"
        class="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        @click="addItem"
      >
        <Plus class="w-3.5 h-3.5" />
        添加明细
      </button>
    </div>

    <!-- 只读视图 -->
    <template v-if="!isDraft">
      <div class="overflow-hidden rounded-xl border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-secondary/50 border-b border-border">
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">描述</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">金额</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">消费日期</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="item in reimbursement.items" :key="item.id" class="hover:bg-secondary/20 transition-colors">
              <td class="px-4 py-3 text-foreground">{{ item.description }}</td>
              <td class="px-4 py-3 text-foreground font-medium">¥{{ item.amount.toLocaleString() }}</td>
              <td class="px-4 py-3 text-muted-foreground text-xs">{{ item.expenseDate }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-secondary/30 border-t border-border">
              <td class="px-4 py-3 text-sm font-medium text-muted-foreground">合计</td>
              <td class="px-4 py-3 text-primary font-heading font-bold" colspan="2">
                ¥{{ reimbursement.totalAmount.toLocaleString() }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </template>

    <!-- 可编辑视图（草稿状态） -->
    <template v-else>
      <div class="space-y-3">
        <div
          v-for="(item, idx) in editableItems"
          :key="idx"
          class="glass-card p-4 space-y-3"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-muted-foreground">明细 {{ idx + 1 }}</span>
            <button
              v-if="editableItems.length > 1"
              class="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
              @click="removeItem(idx)"
            >
              <Trash2 class="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <label class="block text-xs text-muted-foreground mb-1">描述</label>
            <input
              v-model="item.description"
              class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-muted-foreground mb-1">金额（元）</label>
              <input
                v-model="item.amount"
                type="number"
                min="0"
                step="0.01"
                class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label class="block text-xs text-muted-foreground mb-1">消费日期</label>
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
      <div class="flex justify-between items-center border-t border-border pt-4 px-1">
        <span class="text-sm text-muted-foreground">报销总计</span>
        <span class="text-lg font-heading font-bold text-primary">¥{{ totalAmount.toFixed(2) }}</span>
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
          {{ saving ? '保存中...' : '保存明细' }}
        </button>
      </div>
    </template>
  </div>
</template>
