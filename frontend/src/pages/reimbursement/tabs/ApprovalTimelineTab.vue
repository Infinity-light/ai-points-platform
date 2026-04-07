<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { approvalApi, type ApprovalInstance } from '@/services/approval';
import { CheckCircle, XCircle, Clock, Circle } from 'lucide-vue-next';

const props = defineProps<{
  reimbursementId: string;
  approvalInstanceId: string | null;
}>();

const instance = ref<ApprovalInstance | null>(null);
const loading = ref(true);
const error = ref('');

// Approve/reject action
const actionLoading = ref(false);
const actionError = ref('');
const actionComment = ref('');
const showActionForm = ref(false);
const pendingAction = ref<'approve' | 'reject'>('approve');

interface StepInfo {
  step: number;
  label: string;
  approverId: string | null;
  status: 'approved' | 'rejected' | 'pending' | 'not_reached';
  record: import('@/services/approval').ApprovalRecord | null;
}

const steps = computed<StepInfo[]>(() => {
  if (!instance.value) return [];
  const inst = instance.value;
  return [1, 2, 3].map((step) => {
    const approverId = step === 1
      ? inst.step1ApproverId
      : step === 2
        ? inst.step2ApproverId
        : inst.step3ApproverId;
    const record = inst.records.find((r) => r.step === step) ?? null;
    let status: StepInfo['status'] = 'not_reached';
    if (record) {
      status = record.action === 'approve' ? 'approved' : 'rejected';
    } else if (approverId && inst.currentStep === step) {
      status = 'pending';
    }
    const labels: Record<number, string> = { 1: '部门审批', 2: '财务审批', 3: '最终审批' };
    return { step, label: labels[step], approverId, status, record };
  });
});

async function load() {
  if (!props.approvalInstanceId) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    instance.value = await approvalApi.getInstance(props.approvalInstanceId);
  } catch {
    error.value = '加载审批进度失败';
  } finally {
    loading.value = false;
  }
}

function openAction(action: 'approve' | 'reject') {
  pendingAction.value = action;
  actionComment.value = '';
  actionError.value = '';
  showActionForm.value = true;
}

async function submitAction() {
  if (!props.approvalInstanceId) return;
  actionLoading.value = true;
  actionError.value = '';
  try {
    await approvalApi.approve(props.approvalInstanceId, {
      action: pendingAction.value,
      comment: actionComment.value.trim() || undefined,
    });
    showActionForm.value = false;
    await load();
  } catch {
    actionError.value = '操作失败，请重试';
  } finally {
    actionLoading.value = false;
  }
}

function stepIconClass(status: StepInfo['status']): string {
  if (status === 'approved') return 'text-green-400';
  if (status === 'rejected') return 'text-red-400';
  if (status === 'pending') return 'text-amber-400';
  return 'text-muted-foreground';
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString('zh-CN');
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div v-if="!approvalInstanceId" class="text-center py-12 text-muted-foreground text-sm">
      此报销尚未进入审批流程
    </div>

    <div v-else-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-24 bg-secondary rounded-xl animate-pulse" />
    </div>

    <div v-else-if="error" class="text-center py-8 text-red-400 text-sm">{{ error }}</div>

    <template v-else-if="instance">
      <!-- 整体状态 -->
      <div class="glass-card p-4 flex items-center justify-between">
        <div>
          <p class="text-xs text-muted-foreground mb-1">审批状态</p>
          <p class="text-sm font-medium text-foreground">
            {{ instance.status === 'pending' ? `进行中（第 ${instance.currentStep} 步）` :
               instance.status === 'approved' ? '已全部批准' :
               instance.status === 'rejected' ? '已拒绝' : instance.status }}
          </p>
        </div>
        <div v-if="instance.status === 'pending'" class="flex gap-2">
          <button
            class="px-3 py-1.5 text-xs rounded-lg border border-border text-muted-foreground hover:text-red-400 hover:border-red-400/30 transition-colors"
            @click="openAction('reject')"
          >
            拒绝
          </button>
          <button
            class="px-3 py-1.5 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            @click="openAction('approve')"
          >
            批准
          </button>
        </div>
      </div>

      <!-- 审批步骤时间线 -->
      <div class="space-y-3">
        <div
          v-for="stepInfo in steps"
          :key="stepInfo.step"
          class="glass-card p-4 flex items-start gap-4"
          :class="stepInfo.approverId ? '' : 'opacity-40'"
        >
          <div class="mt-0.5" :class="stepIconClass(stepInfo.status)">
            <CheckCircle v-if="stepInfo.status === 'approved'" class="w-5 h-5" />
            <XCircle v-else-if="stepInfo.status === 'rejected'" class="w-5 h-5" />
            <Clock v-else-if="stepInfo.status === 'pending'" class="w-5 h-5" />
            <Circle v-else class="w-5 h-5" />
          </div>

          <div class="flex-1">
            <div class="flex items-center justify-between">
              <p class="text-sm font-medium text-foreground">{{ stepInfo.label }}</p>
              <span
                v-if="stepInfo.record"
                class="text-xs text-muted-foreground"
              >
                {{ formatDate(stepInfo.record.createdAt) }}
              </span>
            </div>
            <p v-if="stepInfo.approverId" class="text-xs text-muted-foreground mt-0.5">
              审批人：<span class="font-mono">{{ stepInfo.approverId.slice(0, 8) }}...</span>
            </p>
            <p v-else class="text-xs text-muted-foreground mt-0.5">此步骤已跳过</p>
            <p v-if="stepInfo.record?.comment" class="text-xs text-foreground mt-1.5 bg-secondary/50 rounded-lg px-3 py-2">
              "{{ stepInfo.record.comment }}"
            </p>
          </div>
        </div>
      </div>

      <!-- 操作表单 -->
      <div v-if="showActionForm" class="glass-card p-4 space-y-3">
        <p class="text-sm font-medium text-foreground">
          {{ pendingAction === 'approve' ? '批准审批' : '拒绝审批' }}
        </p>
        <div>
          <label class="block text-xs text-muted-foreground mb-1.5">审批意见（可选）</label>
          <textarea
            v-model="actionComment"
            rows="3"
            class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors resize-none"
            :placeholder="pendingAction === 'reject' ? '请说明拒绝原因...' : '批准意见...'"
          />
        </div>
        <p v-if="actionError" class="text-xs text-destructive">{{ actionError }}</p>
        <div class="flex gap-2 justify-end">
          <button
            class="px-3 py-1.5 text-sm rounded-lg border border-border text-muted-foreground hover:bg-white/5 transition-colors"
            @click="showActionForm = false"
          >
            取消
          </button>
          <button
            class="px-4 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :class="pendingAction === 'approve'
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-red-500 text-white hover:bg-red-600'"
            :disabled="actionLoading"
            @click="submitAction"
          >
            {{ actionLoading ? '处理中...' : (pendingAction === 'approve' ? '确认批准' : '确认拒绝') }}
          </button>
        </div>
      </div>
    </template>
  </div>
</template>
