<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { reimbursementApi, type Reimbursement } from '@/services/reimbursement';
import { approvalApi, type ApprovalInstance } from '@/services/approval';
import { Receipt, Plus } from 'lucide-vue-next';

const router = useRouter();

type TabKey = 'mine' | 'pending';
const activeTab = ref<TabKey>('mine');

const myReimbursements = ref<Reimbursement[]>([]);
const pendingApprovals = ref<ApprovalInstance[]>([]);
const loading = ref(true);
const error = ref('');

const tabs: { key: TabKey; label: string }[] = [
  { key: 'mine', label: '我的报销' },
  { key: 'pending', label: '待我审批' },
];

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [mine, pending] = await Promise.all([
      reimbursementApi.list(),
      approvalApi.getPending(),
    ]);
    myReimbursements.value = mine;
    pendingApprovals.value = pending.filter((i) => i.businessType === 'reimbursement');
  } catch {
    error.value = '加载数据失败';
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

function approvalStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待处理',
    approved: '已批准',
    rejected: '已拒绝',
    cancelled: '已取消',
  };
  return map[status] ?? status;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN');
}

const pendingCount = computed(() => pendingApprovals.value.length);

onMounted(load);
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto">
    <!-- 标题 -->
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Receipt class="w-6 h-6 text-primary" />
          报销中心
        </h1>
        <p class="text-sm text-muted-foreground mt-0.5">管理报销申请与审批</p>
      </div>
      <button
        class="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150"
        @click="router.push('/reimbursements/create')"
      >
        <Plus class="w-4 h-4" />
        新建报销
      </button>
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
          <span
            v-if="tab.key === 'pending' && pendingCount > 0"
            class="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400"
          >
            {{ pendingCount }}
          </span>
        </button>
      </nav>
    </div>

    <div v-if="error" class="glass-card p-8 text-center text-red-400 text-sm">{{ error }}</div>

    <div v-else-if="loading" class="space-y-3">
      <div v-for="i in 5" :key="i" class="h-16 bg-secondary rounded-xl animate-pulse" />
    </div>

    <!-- 我的报销 -->
    <template v-else-if="activeTab === 'mine'">
      <div v-if="myReimbursements.length === 0" class="glass-card p-12 text-center">
        <Receipt class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p class="text-muted-foreground text-sm">暂无报销记录</p>
      </div>
      <div v-else class="overflow-hidden rounded-xl border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-secondary/50 border-b border-border">
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">标题</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">类型</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">金额</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">日期</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="r in myReimbursements"
              :key="r.id"
              class="hover:bg-secondary/20 transition-colors cursor-pointer"
              @click="router.push(`/reimbursements/${r.id}`)"
            >
              <td class="px-4 py-3 text-foreground font-medium">{{ r.title }}</td>
              <td class="px-4 py-3 text-muted-foreground">{{ r.reimbursementType }}</td>
              <td class="px-4 py-3 text-foreground font-semibold">¥{{ r.totalAmount.toLocaleString() }}</td>
              <td class="px-4 py-3">
                <span
                  class="px-2 py-0.5 rounded-full text-xs font-medium"
                  :class="statusClass(r.status)"
                >
                  {{ statusLabel(r.status) }}
                </span>
              </td>
              <td class="px-4 py-3 text-muted-foreground text-xs">{{ formatDate(r.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- 待我审批 -->
    <template v-else-if="activeTab === 'pending'">
      <div v-if="pendingApprovals.length === 0" class="glass-card p-12 text-center">
        <Receipt class="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p class="text-muted-foreground text-sm">暂无待审批的报销</p>
      </div>
      <div v-else class="overflow-hidden rounded-xl border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-secondary/50 border-b border-border">
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">业务 ID</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">当前步骤</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">状态</th>
              <th class="px-4 py-3 text-left text-xs font-medium text-muted-foreground">提交人</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr
              v-for="instance in pendingApprovals"
              :key="instance.id"
              class="hover:bg-secondary/20 transition-colors cursor-pointer"
              @click="router.push(`/reimbursements/${instance.businessId}`)"
            >
              <td class="px-4 py-3 font-mono text-xs text-muted-foreground">
                {{ instance.businessId.slice(0, 8) }}...
              </td>
              <td class="px-4 py-3 text-foreground">第 {{ instance.currentStep }} 步</td>
              <td class="px-4 py-3">
                <span class="px-2 py-0.5 rounded-full text-xs font-medium text-amber-400 bg-amber-400/10">
                  {{ approvalStatusLabel(instance.status) }}
                </span>
              </td>
              <td class="px-4 py-3 font-mono text-xs text-muted-foreground">
                {{ instance.submitterId.slice(0, 8) }}...
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
