<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { assetApi, type Asset, type DepreciationResult } from '@/services/asset';
import { TrendingDown } from 'lucide-vue-next';

const props = defineProps<{ asset: Asset }>();

const depreciation = ref<DepreciationResult | null>(null);
const loading = ref(true);
const error = ref('');

const hasDepreciationData = computed(
  () => props.asset.purchasePrice != null && props.asset.usefulLifeMonths != null,
);

async function load() {
  if (!hasDepreciationData.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    depreciation.value = await assetApi.getDepreciation(props.asset.id);
  } catch {
    error.value = '加载折旧信息失败';
  } finally {
    loading.value = false;
  }
}

function formatCurrency(val: number): string {
  return '¥' + val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

onMounted(load);
</script>

<template>
  <div class="space-y-4">
    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-28 bg-secondary rounded-xl animate-pulse" />
    </div>

    <div v-else-if="!hasDepreciationData" class="text-center py-12 text-muted-foreground text-sm">
      <TrendingDown class="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p>此资产未设置采购价格或使用寿命，无法计算折旧</p>
    </div>

    <div v-else-if="error" class="text-center py-8 text-red-400 text-sm">{{ error }}</div>

    <template v-else-if="depreciation">
      <!-- 折旧概览卡片 -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="glass-card p-5 text-center">
          <p class="text-xs text-muted-foreground mb-2">采购原值</p>
          <p class="text-2xl font-heading font-bold text-foreground">
            {{ formatCurrency(asset.purchasePrice!) }}
          </p>
        </div>
        <div class="glass-card p-5 text-center">
          <p class="text-xs text-muted-foreground mb-2">累计折旧</p>
          <p class="text-2xl font-heading font-bold text-amber-400">
            {{ formatCurrency(depreciation.accumulated) }}
          </p>
        </div>
        <div class="glass-card p-5 text-center">
          <p class="text-xs text-muted-foreground mb-2">当前账面价值</p>
          <p class="text-2xl font-heading font-bold text-primary">
            {{ formatCurrency(depreciation.bookValue) }}
          </p>
        </div>
      </div>

      <!-- 折旧详情 -->
      <div class="glass-card p-5 space-y-3">
        <h4 class="text-sm font-medium text-foreground">折旧参数</h4>
        <div class="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">每月折旧额</span>
            <span class="text-foreground font-medium">{{ formatCurrency(depreciation.monthlyRate) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-muted-foreground">使用寿命</span>
            <span class="text-foreground font-medium">{{ asset.usefulLifeMonths }} 个月</span>
          </div>
          <div v-if="asset.residualValue != null" class="flex justify-between">
            <span class="text-muted-foreground">预计残值</span>
            <span class="text-foreground font-medium">{{ formatCurrency(asset.residualValue) }}</span>
          </div>
          <div v-if="asset.purchaseDate" class="flex justify-between">
            <span class="text-muted-foreground">采购日期</span>
            <span class="text-foreground font-medium">{{ asset.purchaseDate.slice(0, 10) }}</span>
          </div>
        </div>
      </div>

      <!-- 进度条 -->
      <div class="glass-card p-5">
        <div class="flex justify-between text-xs text-muted-foreground mb-2">
          <span>已折旧比例</span>
          <span>{{ Math.round((depreciation.accumulated / asset.purchasePrice!) * 100) }}%</span>
        </div>
        <div class="h-3 bg-secondary rounded-full overflow-hidden">
          <div
            class="h-full bg-amber-400 rounded-full transition-all duration-500"
            :style="{ width: Math.min(100, Math.round((depreciation.accumulated / asset.purchasePrice!) * 100)) + '%' }"
          />
        </div>
      </div>
    </template>
  </div>
</template>
