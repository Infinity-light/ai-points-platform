<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { reimbursementApi, type Reimbursement } from '@/services/reimbursement';

const props = defineProps<{ assetId: string }>();
const router = useRouter();

const reimbursements = ref<Reimbursement[]>([]);
const loading = ref(true);
const error = ref('');

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

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN');
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const all = await reimbursementApi.list({ linkedAssetId: props.assetId });
    reimbursements.value = all;
  } catch {
    error.value = '加载关联报销失败';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-14 bg-secondary rounded-xl animate-pulse" />
    </div>

    <div v-else-if="error" class="text-center py-8 text-red-400 text-sm">{{ error }}</div>

    <div v-else-if="reimbursements.length === 0" class="text-center py-12 text-muted-foreground text-sm">
      暂无关联报销记录
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
            v-for="r in reimbursements"
            :key="r.id"
            class="hover:bg-secondary/20 transition-colors cursor-pointer"
            @click="router.push(`/reimbursements/${r.id}`)"
          >
            <td class="px-4 py-3 text-foreground">{{ r.title }}</td>
            <td class="px-4 py-3 text-muted-foreground">{{ r.reimbursementType }}</td>
            <td class="px-4 py-3 text-foreground font-medium">¥{{ r.totalAmount.toLocaleString() }}</td>
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
  </div>
</template>
