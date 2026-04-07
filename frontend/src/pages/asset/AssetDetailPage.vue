<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { assetApi, type Asset } from '@/services/asset';
import { ChevronLeft } from 'lucide-vue-next';
import AssetInfoTab from './tabs/AssetInfoTab.vue';
import AssetOperationsTab from './tabs/AssetOperationsTab.vue';
import AssetDepreciationTab from './tabs/AssetDepreciationTab.vue';
import AssetReimbursementsTab from './tabs/AssetReimbursementsTab.vue';

const route = useRoute();
const router = useRouter();

const assetId = computed(() => route.params.id as string);
const asset = ref<Asset | null>(null);
const loading = ref(true);
const error = ref('');

type TabKey = 'info' | 'operations' | 'depreciation' | 'reimbursements';
const activeTab = ref<TabKey>('info');

const tabs: { key: TabKey; label: string }[] = [
  { key: 'info', label: '基本信息' },
  { key: 'operations', label: '操作记录' },
  { key: 'depreciation', label: '折旧信息' },
  { key: 'reimbursements', label: '关联报销' },
];

async function load() {
  loading.value = true;
  error.value = '';
  try {
    asset.value = await assetApi.get(assetId.value);
  } catch {
    error.value = '加载资产信息失败';
  } finally {
    loading.value = false;
  }
}

function handleUpdated(updated: Asset) {
  asset.value = updated;
}

onMounted(load);
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <!-- 返回 + 标题 -->
    <div class="mb-6">
      <button
        class="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        @click="router.push('/assets')"
      >
        <ChevronLeft class="w-4 h-4" />
        返回资产列表
      </button>

      <div v-if="loading" class="h-8 w-48 bg-secondary rounded-lg animate-pulse" />
      <div v-else-if="asset">
        <h1 class="text-2xl font-heading font-bold text-foreground">{{ asset.name }}</h1>
        <p class="text-sm text-muted-foreground mt-0.5 font-mono">{{ asset.assetCode }}</p>
      </div>
    </div>

    <div v-if="error" class="glass-card p-8 text-center text-red-400 text-sm">{{ error }}</div>

    <template v-else-if="asset">
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

      <!-- Tab 内容 -->
      <AssetInfoTab
        v-if="activeTab === 'info'"
        :asset="asset"
        @updated="handleUpdated"
      />
      <AssetOperationsTab
        v-else-if="activeTab === 'operations'"
        :asset-id="assetId"
      />
      <AssetDepreciationTab
        v-else-if="activeTab === 'depreciation'"
        :asset="asset"
      />
      <AssetReimbursementsTab
        v-else-if="activeTab === 'reimbursements'"
        :asset-id="assetId"
      />
    </template>
  </div>
</template>
