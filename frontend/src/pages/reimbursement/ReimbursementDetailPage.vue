<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { reimbursementApi, type Reimbursement } from '@/services/reimbursement';
import { useAuthStore } from '@/stores/auth';
import { ChevronLeft, X } from 'lucide-vue-next';
import ReimbursementItemsTab from './tabs/ReimbursementItemsTab.vue';
import ApprovalTimelineTab from './tabs/ApprovalTimelineTab.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const reimbursementId = computed(() => route.params.id as string);
const reimbursement = ref<Reimbursement | null>(null);
const loading = ref(true);
const error = ref('');

type TabKey = 'info' | 'items' | 'approval';
const activeTab = ref<TabKey>('info');

const tabs: { key: TabKey; label: string }[] = [
  { key: 'info', label: '报销信息' },
  { key: 'items', label: '明细' },
  { key: 'approval', label: '审批进度' },
];

// Action state
const actionLoading = ref(false);
const actionError = ref('');
const showSubmitModal = ref(false);
const submitDeptHeadId = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    reimbursement.value = await reimbursementApi.get(reimbursementId.value);
  } catch {
    error.value = '加载报销信息失败';
  } finally {
    loading.value = false;
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿',
    submitted: '待审批',
    dept_approved: '部门已批',
    finance_approved: '财务已批',
    leader_approved: '领导已批',
    paid: '已付款',
    completed: '已完成',
    rejected: '已拒绝',
  };
  return map[status] ?? status;
}

function statusClass(status: string): string {
  if (status === 'completed') return 'text-green-400 bg-green-400/10';
  if (status === 'rejected') return 'text-red-400 bg-red-400/10';
  if (status === 'draft') return 'text-muted-foreground bg-secondary';
  return 'text-blue-400 bg-blue-400/10';
}

const isSubmitter = computed(
  () => reimbursement.value?.submitterId === authStore.user?.id,
);

const canSubmit = computed(
  () => reimbursement.value?.status === 'draft' && isSubmitter.value,
);

const canMarkPaid = computed(
  () => reimbursement.value?.status === 'leader_approved',
);

const canComplete = computed(
  () => reimbursement.value?.status === 'paid' && isSubmitter.value,
);

const canDelete = computed(
  () => reimbursement.value?.status === 'draft' && isSubmitter.value,
);

async function submitForApproval() {
  actionLoading.value = true;
  actionError.value = '';
  try {
    const updated = await reimbursementApi.submit(reimbursementId.value, {
      departmentHeadId: submitDeptHeadId.value.trim() || undefined,
    });
    reimbursement.value = updated;
    showSubmitModal.value = false;
  } catch {
    actionError.value = '提交失败，请重试';
  } finally {
    actionLoading.value = false;
  }
}

async function markPaid() {
  actionLoading.value = true;
  actionError.value = '';
  try {
    const updated = await reimbursementApi.markPaid(reimbursementId.value);
    reimbursement.value = updated;
  } catch {
    actionError.value = '操作失败，请重试';
  } finally {
    actionLoading.value = false;
  }
}

async function markComplete() {
  actionLoading.value = true;
  actionError.value = '';
  try {
    const updated = await reimbursementApi.markComplete(reimbursementId.value);
    reimbursement.value = updated;
  } catch {
    actionError.value = '操作失败，请重试';
  } finally {
    actionLoading.value = false;
  }
}

async function deleteReimbursement() {
  if (!confirm('确定要删除此报销申请吗？')) return;
  try {
    await reimbursementApi.delete(reimbursementId.value);
    router.push('/reimbursements');
  } catch {
    actionError.value = '删除失败，请重试';
  }
}

function handleUpdated(updated: Reimbursement) {
  reimbursement.value = updated;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString('zh-CN');
}

onMounted(load);
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <!-- 返回 + 标题 -->
    <div class="mb-6">
      <button
        class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        @click="router.push('/reimbursements')"
      >
        <ChevronLeft class="w-4 h-4" />
        返回报销列表
      </button>

      <div v-if="loading" class="h-8 w-64 bg-secondary rounded-lg animate-pulse" />
      <div v-else-if="reimbursement" class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-heading font-bold text-foreground">{{ reimbursement.title }}</h1>
          <div class="flex items-center gap-2 mt-1">
            <span
              class="px-2.5 py-1 rounded-full text-xs font-medium"
              :class="statusClass(reimbursement.status)"
            >
              {{ statusLabel(reimbursement.status) }}
            </span>
            <span class="text-sm text-muted-foreground">{{ reimbursement.reimbursementType }}</span>
          </div>
        </div>
        <div class="text-right shrink-0">
          <p class="text-2xl font-heading font-bold text-primary">
            ¥{{ reimbursement.totalAmount.toLocaleString() }}
          </p>
          <p class="text-xs text-muted-foreground mt-0.5">{{ formatDate(reimbursement.createdAt) }}</p>
        </div>
      </div>
    </div>

    <div v-if="error" class="glass-card p-8 text-center text-red-400 text-sm">{{ error }}</div>

    <template v-else-if="reimbursement">
      <!-- 操作按钮 -->
      <div class="flex flex-wrap items-center gap-2 mb-5">
        <button
          v-if="canSubmit"
          class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="actionLoading"
          @click="showSubmitModal = true"
        >
          提交审批
        </button>
        <button
          v-if="canMarkPaid"
          class="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="actionLoading"
          @click="markPaid"
        >
          {{ actionLoading ? '处理中...' : '标记已付款' }}
        </button>
        <button
          v-if="canComplete"
          class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="actionLoading"
          @click="markComplete"
        >
          {{ actionLoading ? '处理中...' : '确认完成' }}
        </button>
        <button
          v-if="canDelete"
          class="px-4 py-2 text-sm rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors duration-150"
          @click="deleteReimbursement"
        >
          删除
        </button>
        <p v-if="actionError" class="text-xs text-destructive">{{ actionError }}</p>
      </div>

      <!-- Tab 栏 -->
      <div class="border-b border-border mb-6">
        <nav class="flex gap-1">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="px-4 pb-3 text-sm font-medium transition-colors duration-200 border-b-2 -mb-px whitespace-nowrap cursor-pointer"
            :class="
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            "
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </nav>
      </div>

      <!-- 报销信息 Tab -->
      <div v-if="activeTab === 'info'" class="glass-card p-5 space-y-3">
        <div class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <p class="text-xs text-muted-foreground mb-0.5">提交人 ID</p>
            <p class="text-foreground font-mono text-xs">{{ reimbursement.submitterId.slice(0, 12) }}...</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground mb-0.5">报销类型</p>
            <p class="text-foreground">{{ reimbursement.reimbursementType }}</p>
          </div>
          <div v-if="reimbursement.linkedAssetId">
            <p class="text-xs text-muted-foreground mb-0.5">关联资产</p>
            <p class="text-foreground font-mono text-xs">{{ reimbursement.linkedAssetId.slice(0, 12) }}...</p>
          </div>
          <div v-if="reimbursement.paidAt">
            <p class="text-xs text-muted-foreground mb-0.5">付款时间</p>
            <p class="text-foreground text-xs">{{ formatDate(reimbursement.paidAt) }}</p>
          </div>
          <div v-if="reimbursement.paymentReference">
            <p class="text-xs text-muted-foreground mb-0.5">付款参考号</p>
            <p class="text-foreground">{{ reimbursement.paymentReference }}</p>
          </div>
          <div>
            <p class="text-xs text-muted-foreground mb-0.5">创建时间</p>
            <p class="text-foreground text-xs">{{ formatDate(reimbursement.createdAt) }}</p>
          </div>
        </div>
        <div v-if="reimbursement.notes" class="border-t border-border pt-3">
          <p class="text-xs text-muted-foreground mb-1">备注</p>
          <p class="text-sm text-foreground">{{ reimbursement.notes }}</p>
        </div>
      </div>

      <ReimbursementItemsTab
        v-else-if="activeTab === 'items'"
        :reimbursement="reimbursement"
        @updated="handleUpdated"
      />

      <ApprovalTimelineTab
        v-else-if="activeTab === 'approval'"
        :reimbursement-id="reimbursementId"
        :approval-instance-id="reimbursement.approvalInstanceId"
      />
    </template>

    <!-- Submit modal -->
    <Teleport to="body">
      <div
        v-if="showSubmitModal"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="showSubmitModal = false"
      >
        <div class="glass-card w-full max-w-md p-6 shadow-2xl">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-lg font-heading font-semibold text-foreground">提交审批</h2>
            <button
              class="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              @click="showSubmitModal = false"
            >
              <X class="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          <div>
            <label class="block text-xs text-muted-foreground mb-1.5">部门负责人 ID（可选）</label>
            <input
              v-model="submitDeptHeadId"
              class="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder="部门负责人用户 UUID，留空则自动匹配"
            />
          </div>

          <p v-if="actionError" class="text-xs text-destructive mt-3">{{ actionError }}</p>

          <div class="flex gap-2 justify-end mt-5">
            <button
              class="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-white/5 transition-colors duration-150"
              @click="showSubmitModal = false"
            >
              取消
            </button>
            <button
              class="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
              :disabled="actionLoading"
              @click="submitForApproval"
            >
              {{ actionLoading ? '提交中...' : '确认提交' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
