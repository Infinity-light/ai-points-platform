<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { approvalApi, type ApprovalBatch, type ApprovalBatchDetail } from '@/services/points';
import BaseButton from '@/components/ui/BaseButton.vue';
import { ChevronDown } from 'lucide-vue-next';

const batches = ref<ApprovalBatch[]>([]);
const loading = ref(false);
const error = ref('');

const expandedId = ref<string | null>(null);
const batchDetail = ref<ApprovalBatchDetail | null>(null);
const detailLoading = ref(false);

const rejectTarget = ref<string | null>(null);
const rejectNote = ref('');
const actionLoading = ref<Record<string, boolean>>({});

const statusConfig: Record<ApprovalBatch['status'], { label: string; class: string }> = {
  pending: { label: '待审批', class: 'bg-yellow-500/10 text-yellow-400' },
  approved: { label: '已批准', class: 'bg-green-500/10 text-green-400' },
  rejected: { label: '已驳回', class: 'bg-destructive/10 text-destructive' },
};

async function loadBatches() {
  loading.value = true;
  error.value = '';
  try {
    const res = await approvalApi.list();
    batches.value = res.data;
  } catch {
    error.value = '加载审批队列失败，请刷新重试';
  } finally {
    loading.value = false;
  }
}

async function toggleDetail(batch: ApprovalBatch) {
  if (expandedId.value === batch.id) {
    expandedId.value = null;
    batchDetail.value = null;
    return;
  }
  expandedId.value = batch.id;
  detailLoading.value = true;
  try {
    const res = await approvalApi.get(batch.id);
    batchDetail.value = res.data;
  } catch {
    batchDetail.value = null;
  } finally {
    detailLoading.value = false;
  }
}

async function approveBatch(batchId: string) {
  actionLoading.value[batchId] = true;
  error.value = '';
  try {
    const res = await approvalApi.approve(batchId);
    const idx = batches.value.findIndex((b) => b.id === batchId);
    if (idx !== -1) batches.value[idx] = res.data;
  } catch {
    error.value = '审批操作失败，请重试';
  } finally {
    actionLoading.value[batchId] = false;
  }
}

function openReject(batchId: string) {
  rejectTarget.value = batchId;
  rejectNote.value = '';
}

async function submitReject() {
  if (!rejectTarget.value) return;
  const batchId = rejectTarget.value;
  actionLoading.value[batchId] = true;
  error.value = '';
  try {
    const res = await approvalApi.reject({ id: batchId, reviewNote: rejectNote.value || undefined });
    const idx = batches.value.findIndex((b) => b.id === batchId);
    if (idx !== -1) batches.value[idx] = res.data;
    rejectTarget.value = null;
  } catch {
    error.value = '驳回操作失败，请重试';
  } finally {
    actionLoading.value[batchId] = false;
  }
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

onMounted(() => {
  void loadBatches();
});
</script>

<template>
  <div>
    <div
      v-if="error"
      class="bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg mb-4"
    >
      {{ error }}
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-16 bg-secondary rounded animate-pulse" />
    </div>

    <div
      v-else-if="batches.length === 0"
      class="text-center py-12 text-muted-foreground text-sm"
    >
      暂无待审批工分批次
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="batch in batches"
        :key="batch.id"
        class="glass-card overflow-hidden"
      >
        <div
          class="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors duration-200"
          @click="toggleDetail(batch)"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-sm font-medium text-foreground truncate">
                {{ batch.projectName ?? '未知项目' }}
              </span>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                :class="statusConfig[batch.status].class"
              >
                {{ statusConfig[batch.status].label }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground">
              提交人：{{ batch.submitterName ?? batch.submittedBy }} ·
              {{ formatDateTime(batch.createdAt) }}
            </p>
          </div>

          <div class="text-right shrink-0">
            <p class="text-sm font-mono font-medium text-foreground">{{ batch.totalPoints }} 分</p>
            <p class="text-xs text-muted-foreground">{{ batch.pointRecordIds.length }} 条记录</p>
          </div>

          <div class="flex gap-2 shrink-0" @click.stop>
            <BaseButton
              v-if="batch.status === 'pending'"
              size="sm"
              :loading="actionLoading[batch.id]"
              @click="approveBatch(batch.id)"
            >
              批准
            </BaseButton>
            <BaseButton
              v-if="batch.status === 'pending'"
              size="sm"
              variant="outline"
              :loading="actionLoading[batch.id]"
              @click="openReject(batch.id)"
            >
              驳回
            </BaseButton>
          </div>

          <ChevronDown
            class="w-4 h-4 text-muted-foreground transition-transform shrink-0"
            :class="expandedId === batch.id ? 'rotate-180' : ''"
          />
        </div>

        <div v-if="expandedId === batch.id" class="border-t border-border px-4 py-3">
          <div v-if="detailLoading" class="space-y-2">
            <div v-for="i in 3" :key="i" class="h-8 bg-secondary rounded animate-pulse" />
          </div>
          <div v-else-if="batchDetail">
            <p class="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              工分明细
            </p>
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-muted-foreground border-b border-border">
                  <th class="pb-2 font-medium">任务名</th>
                  <th class="pb-2 font-medium text-right">工分</th>
                  <th class="pb-2 font-medium text-right">获得时间</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr
                  v-for="record in batchDetail.pointRecords"
                  :key="record.id"
                  class="hover:bg-white/5 transition-colors duration-200"
                >
                  <td class="py-2 text-foreground">{{ record.taskTitle }}</td>
                  <td class="py-2 text-right font-mono font-medium text-primary">{{ record.points }}</td>
                  <td class="py-2 text-right font-mono text-muted-foreground">
                    {{ formatDateTime(record.acquiredAt) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-if="batch.reviewNote" class="mt-3 text-xs text-muted-foreground">
              审批备注：{{ batch.reviewNote }}
            </div>
          </div>
          <div v-else class="text-xs text-muted-foreground py-2">加载明细失败</div>
        </div>
      </div>
    </div>
  </div>

  <!-- 驳回模态框 -->
  <div
    v-if="rejectTarget"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    @click.self="rejectTarget = null"
  >
    <div class="glass-card shadow-xl w-full max-w-sm mx-4 p-6">
      <h3 class="font-heading font-semibold text-foreground mb-4">驳回工分批次</h3>
      <div>
        <label class="block text-sm text-muted-foreground mb-1">驳回备注（可选）</label>
        <textarea
          v-model="rejectNote"
          rows="3"
          placeholder="填写驳回原因..."
          class="w-full px-3 py-2 text-sm rounded border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none transition-colors duration-200 text-foreground"
        />
      </div>
      <div class="flex gap-2 mt-4">
        <BaseButton
          class="flex-1"
          variant="outline"
          :loading="rejectTarget ? actionLoading[rejectTarget] : false"
          @click="submitReject"
        >
          确认驳回
        </BaseButton>
        <BaseButton variant="ghost" class="flex-1" @click="rejectTarget = null">
          取消
        </BaseButton>
      </div>
    </div>
  </div>
</template>
