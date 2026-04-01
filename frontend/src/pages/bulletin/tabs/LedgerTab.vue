<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { bulletinApi, type Settlement, type Dividend } from '@/services/bulletin';
import { Receipt, Wallet } from 'lucide-vue-next';

type SubTab = 'settlements' | 'dividends';

const activeTab = ref<SubTab>('settlements');
const settlements = ref<Settlement[]>([]);
const dividends = ref<Dividend[]>([]);
const settlementTotal = ref(0);
const dividendTotal = ref(0);
const loading = ref(false);
const error = ref('');

const PAGE = 20;

async function loadSettlements(page = 1) {
  loading.value = true;
  error.value = '';
  try {
    const res = await bulletinApi.getSettlements({ page, limit: PAGE });
    settlements.value = res.data.data;
    settlementTotal.value = res.data.meta.total;
  } catch (e) {
    error.value = '加载结算记录失败';
  } finally {
    loading.value = false;
  }
}

async function loadDividends(page = 1) {
  loading.value = true;
  error.value = '';
  try {
    const res = await bulletinApi.getDividends({ page, limit: PAGE });
    dividends.value = res.data.data;
    dividendTotal.value = res.data.meta.total;
  } catch (e) {
    error.value = '加载分红记录失败';
  } finally {
    loading.value = false;
  }
}

function switchTab(tab: SubTab) {
  activeTab.value = tab;
  if (tab === 'settlements' && settlements.value.length === 0) loadSettlements();
  if (tab === 'dividends' && dividends.value.length === 0) loadDividends();
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿',
    pending_approval: '待审批',
    approved: '已批准',
    rejected: '已拒绝',
  };
  return map[status] ?? status;
}

function statusClass(status: string): string {
  if (status === 'approved') return 'text-green-400 bg-green-400/10';
  if (status === 'pending_approval') return 'text-yellow-400 bg-yellow-400/10';
  if (status === 'rejected') return 'text-destructive bg-destructive/10';
  return 'text-muted-foreground bg-secondary';
}

onMounted(() => loadSettlements());
</script>

<template>
  <div>
    <!-- 子 Tab -->
    <div class="flex gap-4 mb-5 border-b border-border">
      <button
        class="pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5"
        :class="activeTab === 'settlements' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="switchTab('settlements')"
      >
        <Receipt class="w-3.5 h-3.5" />
        结算记录
        <span class="text-xs">（{{ settlementTotal }}）</span>
      </button>
      <button
        class="pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5"
        :class="activeTab === 'dividends' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'"
        @click="switchTab('dividends')"
      >
        <Wallet class="w-3.5 h-3.5" />
        分红记录
        <span class="text-xs">（{{ dividendTotal }}）</span>
      </button>
    </div>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 5" :key="i" class="h-14 bg-secondary rounded-lg animate-pulse" />
    </div>
    <div v-else-if="error" class="text-center py-8 text-muted-foreground text-sm">{{ error }}</div>

    <!-- 结算列表 -->
    <template v-else-if="activeTab === 'settlements'">
      <div v-if="settlements.length === 0" class="text-center py-8 text-muted-foreground text-sm">
        暂无结算记录
      </div>
      <div v-else class="space-y-2">
        <div v-for="s in settlements" :key="s.id" class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-foreground">第 {{ s.roundNumber }} 轮结算</p>
              <p class="text-xs text-muted-foreground mt-0.5">
                共 {{ s.settledTaskIds.length }} 个任务 ·
                发放 {{ s.summary.totalPointsAwarded }} 工分 ·
                {{ s.summary.usersAffected }} 人受益
              </p>
            </div>
            <p class="text-xs text-muted-foreground">{{ new Date(s.createdAt).toLocaleDateString('zh-CN') }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- 分红列表 -->
    <template v-else>
      <div v-if="dividends.length === 0" class="text-center py-8 text-muted-foreground text-sm">
        暂无分红记录
      </div>
      <div v-else class="space-y-2">
        <div v-for="d in dividends" :key="d.id" class="glass-card p-4">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="text-sm font-medium text-foreground">第 {{ d.roundNumber }} 轮分红</span>
                <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="statusClass(d.status)">
                  {{ statusLabel(d.status) }}
                </span>
              </div>
              <p class="text-xs text-muted-foreground">
                总金额：{{ d.totalAmount !== null ? d.totalAmount : '未填写' }} ·
                基于 {{ d.totalActivePoints }} 活跃工分
              </p>
            </div>
            <p class="text-xs text-muted-foreground">{{ new Date(d.createdAt).toLocaleDateString('zh-CN') }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
