<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue';
import { BarChart3, Receipt, Gavel as GavelIcon, Shield } from 'lucide-vue-next';

type TabKey = 'leaderboard' | 'ledger' | 'decisions' | 'audit';

interface TabDef {
  key: TabKey;
  label: string;
  icon: unknown;
  component: ReturnType<typeof defineAsyncComponent>;
}

const tabs: TabDef[] = [
  {
    key: 'leaderboard',
    label: '排行榜',
    icon: BarChart3,
    component: defineAsyncComponent(() => import('./tabs/LeaderboardTab.vue')),
  },
  {
    key: 'ledger',
    label: '账目',
    icon: Receipt,
    component: defineAsyncComponent(() => import('./tabs/LedgerTab.vue')),
  },
  {
    key: 'decisions',
    label: '决策',
    icon: GavelIcon,
    component: defineAsyncComponent(() => import('./tabs/DecisionTab.vue')),
  },
  {
    key: 'audit',
    label: '审计',
    icon: Shield,
    component: defineAsyncComponent(() => import('./tabs/AuditTrailTab.vue')),
  },
];

const activeTabKey = ref<TabKey>('leaderboard');

const activeTab = () => tabs.find((t) => t.key === activeTabKey.value) ?? tabs[0];
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto">
    <!-- 标题 -->
    <div class="mb-6">
      <h1 class="text-2xl font-heading font-bold text-foreground">公示区</h1>
      <p class="text-sm text-muted-foreground mt-0.5">项目结算与工分分红公示</p>
    </div>

    <!-- Tab 栏 -->
    <div class="border-b border-border mb-6">
      <nav class="flex gap-1 overflow-x-auto">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="flex items-center gap-1.5 px-4 pb-3 text-sm font-medium transition-colors duration-200 border-b-2 -mb-px whitespace-nowrap"
          :class="
            activeTabKey === tab.key
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          "
          @click="activeTabKey = tab.key"
        >
          <component :is="tab.icon" class="w-4 h-4" />
          {{ tab.label }}
        </button>
      </nav>
    </div>

    <!-- Tab 内容 -->
    <Suspense>
      <component :is="activeTab().component" />
      <template #fallback>
        <div class="space-y-3">
          <div v-for="i in 5" :key="i" class="h-12 bg-secondary rounded-lg animate-pulse" />
        </div>
      </template>
    </Suspense>
  </div>
</template>
